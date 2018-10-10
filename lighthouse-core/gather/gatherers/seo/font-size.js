/**
 * @license Copyright 2017 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */
'use strict';

/**
 * @fileoverview Extracts information about illegible text from the page.
 *
 * In effort to keep this audit's execution time around 1s, maximum number of protocol calls was limited.
 * Firstly, number of visited nodes (text nodes for which font size was checked) is capped. Secondly, number of failing nodes that are analyzed (for which detailed CSS information is extracted) is also limited.
 *
 * This gatherer collects stylesheet metadata by itself, instead of relying on the styles gatherer which is slow (because it parses the stylesheet content).
 */

const CSSMatchedStyles = require('../../../lib/web-inspector').CSSMatchedStyles;
const Gatherer = require('../gatherer');
const FONT_SIZE_PROPERTY_NAME = 'font-size';
const TEXT_NODE_BLOCK_LIST = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT']);
const MINIMAL_LEGIBLE_FONT_SIZE_PX = 12;
// limit number of protocol calls to make sure that gatherer doesn't take more than 1-2s
const MAX_NODES_VISITED = 500;
const MAX_NODES_ANALYZED = 50;

/** DevTools uses a numeric enum for nodeType */
const TEXT_NODE_TYPE = 3;

/** @typedef {LH.Artifacts.FontSize['analyzedFailingNodesData'][0]} FailingNodeData */
/** @typedef {LH.Artifacts.FontSize.DomNodeMaybeWithParent} DomNodeMaybeWithParent*/

const Driver = require('../../driver.js'); // eslint-disable-line no-unused-vars

/**
 * @param {LH.Artifacts.FontSize.DomNodeMaybeWithParent=} node
 * @returns {boolean}
 */
function nodeInBody(node) {
  if (!node) {
    return false;
  }
  if (node.nodeName === 'BODY') {
    return true;
  }
  return nodeInBody(node.parentNode);
}

/**
 * Get list of all nodes from the document body.
 *
 * @param {Driver} driver
 * @returns {Promise<Array<LH.Artifacts.FontSize.DomNodeWithParent>>}
 */
async function getAllNodesFromBody(driver) {
  const nodes = /** @type {DomNodeMaybeWithParent[]} */ (await driver.getNodesInDocument());
  /** @type {Map<number, LH.Artifacts.FontSize.DomNodeMaybeWithParent>} */
  const nodeMap = new Map();
  nodes.forEach(node => nodeMap.set(node.nodeId, node));
  nodes.forEach(node => (node.parentNode = nodeMap.get(node.parentId)));
  // @ts-ignore - once passing through the filter, it's guaranteed to have a parent
  return nodes.filter(nodeInBody);
}

/**
 * @param {LH.Crdp.CSS.CSSStyle} [style]
 * @return {boolean}
 */
function hasFontSizeDeclaration(style) {
  return !!style && !!style.cssProperties.find(({name}) => name === FONT_SIZE_PROPERTY_NAME);
}

/**
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/CSS/Specificity
 * @see https://www.smashingmagazine.com/2010/04/css-specificity-and-inheritance/
 *
 * @param {string} selector
 * @return {number}
 */
function computeSelectorSpecificity(selector) {
  const tokens = selector.split(' ');

  let numIDs = 0;
  let numClasses = 0;
  let numTypes = 0;

  for (const token of tokens) {
    const ids = token.match(/\b#[a-z0-9]+/g) || [];
    const classes = token.match(/\b\.[a-z0-9]+/g) || [];
    const types = token.match(/^[a-z]+/) ? [1] : [];
    numIDs += ids.length;
    numClasses += classes.length;
    numTypes += types.length;
  }

  return Math.min(9, numIDs) * 100 + Math.min(9, numClasses) * 10 + Math.min(9, numTypes);
}

/**
 *
 * @param {Array<LH.Crdp.CSS.RuleMatch>} [matchedCSSRules]
 * @returns {FailingNodeData['cssRule']|undefined}
 */
function findDirectCSSRule(matchedCSSRules = []) {
  let maxSpecificity = -Infinity;
  /** @type {LH.Crdp.CSS.CSSRule|undefined} */
  let maxSpecificityRule;

  for (const {rule, matchingSelectors} of matchedCSSRules) {
    if (hasFontSizeDeclaration(rule.style)) {
      const specificities = matchingSelectors.map(idx =>
        computeSelectorSpecificity(rule.selectorList.selectors[idx].text)
      );
      const specificity = Math.max(...specificities);
      // Use greater OR EQUAL so that the last rule wins in the event of a tie
      if (specificity >= maxSpecificity) {
        maxSpecificity = specificity;
        maxSpecificityRule = rule;
      }
    }
  }

  if (maxSpecificityRule) {
    return {
      type: 'Regular',
      ...maxSpecificityRule.style,
      parentRule: {
        origin: maxSpecificityRule.origin,
        selectors: maxSpecificityRule.selectorList.selectors,
      },
    };
  }
}

/**
 *
 * @param {Array<LH.Crdp.CSS.InheritedStyleEntry>} [inheritedEntries]
 * @returns {FailingNodeData['cssRule']|undefined}
 */
function findInheritedCSSRule(inheritedEntries = []) {
  // The inherited array contains the array of matched rules for all parents in ascending tree order.
  // i.e. for an element whose path is `html > body > #main > #nav > p`
  // `inherited` will be an array of styles like `[#nav, #main, body, html]`
  // The closest parent with font-size will win
  for (const {inlineStyle, matchedCSSRules} of inheritedEntries) {
    if (hasFontSizeDeclaration(inlineStyle)) return {type: 'Inline', ...inlineStyle};

    const directRule = findDirectCSSRule(matchedCSSRules);
    if (directRule) return directRule;
  }
}

/**
 * Returns effective CSS rule for given CSS property.
 * This is roughly a stripped down version of the CSSMatchedStyle class in DevTools.
 *
 * @see https://cs.chromium.org/chromium/src/third_party/blink/renderer/devtools/front_end/sdk/CSSMatchedStyles.js?q=CSSMatchedStyles+f:devtools+-f:out&sq=package:chromium&dr=C&l=59-134
 * @param {LH.Crdp.CSS.GetMatchedStylesForNodeResponse} matched CSS rules
 * @returns {FailingNodeData['cssRule']|undefined}
 */
function getEffectiveFontRule({inlineStyle, matchedCSSRules, inherited}) {
  // Inline styles have highest priority
  if (hasFontSizeDeclaration(inlineStyle)) return {type: 'Inline', ...inlineStyle};

  // Rules directly referencing the node come next
  const directRule = findDirectCSSRule(matchedCSSRules);
  if (directRule) return directRule;

  // Finally, find an inherited property if there is one
  const inheritedRule = findInheritedCSSRule(inherited);
  if (inheritedRule) return inheritedRule;

  return undefined;
}

/**
 * @param {LH.Crdp.DOM.Node} node
 * @returns {number}
 */
function getNodeTextLength(node) {
  return !node.nodeValue ? 0 : node.nodeValue.trim().length;
}

/**
 * @param {Driver} driver
 * @param {LH.Crdp.DOM.Node} node text node
 * @returns {Promise<FailingNodeData['cssRule']|undefined>}
 */
async function fetchSourceRule(driver, node) {
  const matchedRules = await driver.sendCommand('CSS.getMatchedStylesForNode', {
    nodeId: node.nodeId,
  });
  const sourceRule = getEffectiveFontRule(matchedRules);
  if (!sourceRule) return undefined;

  return {
    type: sourceRule.type,
    range: sourceRule.range,
    styleSheetId: sourceRule.styleSheetId,
    parentRule: sourceRule.parentRule && {
      origin: sourceRule.parentRule.origin,
      selectors: sourceRule.parentRule.selectors,
    },
  };
}

/**
 * @param {Driver} driver
 * @param {LH.Artifacts.FontSize.DomNodeWithParent} node text node
 * @returns {Promise<?FailingNodeData>}
 */
function fetchComputedFontSize(driver, node) {
  return driver
    .sendCommand('CSS.getComputedStyleForNode', {nodeId: node.parentId})
    .then(result => {
      const {computedStyle} = result;
      const fontSizeProperty = computedStyle.find(({name}) => name === FONT_SIZE_PROPERTY_NAME);

      return {
        // @ts-ignore - font size property guaranteed to be returned in getComputedStyle
        fontSize: parseInt(fontSizeProperty.value, 10),
        textLength: getNodeTextLength(node),
        node: /** @type {LH.Artifacts.FontSize.DomNodeWithParent} */ (node.parentNode),
      };
    })
    .catch(err => {
      require('../../../lib/sentry.js').captureException(err);
      return null;
    });
}

/**
 * @param {LH.Artifacts.FontSize.DomNodeWithParent} node
 * @returns {boolean}
 */
function isNonEmptyTextNode(node) {
  return (
    node.nodeType === TEXT_NODE_TYPE &&
    !TEXT_NODE_BLOCK_LIST.has(node.parentNode.nodeName) &&
    getNodeTextLength(node) > 0
  );
}

class FontSize extends Gatherer {
  /**
   * @param {LH.Gatherer.PassContext['driver']} driver
   */
  static async fetchNodesToAnalyze(driver) {
    let failingTextLength = 0;
    let visitedTextLength = 0;
    let totalTextLength = 0;

    const nodes = await getAllNodesFromBody(driver);

    const textNodes = nodes.filter(isNonEmptyTextNode);
    totalTextLength = textNodes.reduce((sum, node) => (sum += getNodeTextLength(node)), 0);

    const nodesToVisit = textNodes
      .sort((a, b) => getNodeTextLength(b) - getNodeTextLength(a))
      .slice(0, MAX_NODES_VISITED);

    const nodePromises = nodesToVisit.map(node => fetchComputedFontSize(driver, node));
    const visitedNodes = await Promise.all(nodePromises);

    /** @type {Array<FailingNodeData>} */
    const failingNodes = [];
    for (const visitedNode of visitedNodes) {
      if (!visitedNode) continue;
      visitedTextLength += visitedNode.textLength;

      if (visitedNode.fontSize < MINIMAL_LEGIBLE_FONT_SIZE_PX) {
        failingNodes.push(visitedNode);
        failingTextLength += visitedNode.textLength;
      }
    }

    const nodesToAnalyze = failingNodes
      .sort((a, b) => b.textLength - a.textLength)
      .slice(0, MAX_NODES_ANALYZED);

    return {totalTextLength, visitedTextLength, failingTextLength, nodesToAnalyze};
  }

  /**
   *
   * @param {LH.Gatherer.PassContext['driver']} driver
   * @param {Array<FailingNodeData>} nodesToAnalyze
   */
  static async analyzeFailingNodes(driver, nodesToAnalyze) {
    const analysisPromises = nodesToAnalyze.map(async failingNode => {
      failingNode.cssRule = await fetchSourceRule(driver, failingNode.node);
      return failingNode;
    });

    const analyzedFailingNodesData = await Promise.all(analysisPromises);

    const analyzedFailingTextLength = analyzedFailingNodesData.reduce(
      (sum, {textLength}) => (sum += textLength),
      0
    );

    return {analyzedFailingNodesData, analyzedFailingTextLength};
  }

  /**
   * @param {LH.Gatherer.PassContext} passContext
   * @return {Promise<LH.Artifacts.FontSize>} font-size analysis
   */
  async afterPass(passContext) {
    /** @type {Map<string, LH.Crdp.CSS.CSSStyleSheetHeader>} */
    const stylesheets = new Map();
    /** @param {LH.Crdp.CSS.StyleSheetAddedEvent} sheet */
    const onStylesheetAdd = sheet => stylesheets.set(sheet.header.styleSheetId, sheet.header);
    passContext.driver.on('CSS.styleSheetAdded', onStylesheetAdd);

    await passContext.driver.sendCommand('DOM.enable');
    await passContext.driver.sendCommand('CSS.enable');

    const {
      totalTextLength,
      visitedTextLength,
      failingTextLength,
      nodesToAnalyze,
    } = await FontSize.fetchNodesToAnalyze(passContext.driver);

    const {
      analyzedFailingNodesData,
      analyzedFailingTextLength,
    } = await FontSize.analyzeFailingNodes(passContext.driver, nodesToAnalyze);

    passContext.driver.off('CSS.styleSheetAdded', onStylesheetAdd);

    analyzedFailingNodesData
      .filter(data => data.cssRule && data.cssRule.styleSheetId)
      // @ts-ignore - guaranteed to exist from the filter immediately above
      .forEach(data => (data.cssRule.stylesheet = stylesheets.get(data.cssRule.styleSheetId)));

    await passContext.driver.sendCommand('DOM.disable');
    await passContext.driver.sendCommand('CSS.disable');

    return {
      analyzedFailingNodesData,
      analyzedFailingTextLength,
      failingTextLength,
      visitedTextLength,
      totalTextLength,
    };
  }
}

module.exports = FontSize;
module.exports.computeSelectorSpecificity = computeSelectorSpecificity;
module.exports.getEffectiveFontRule = getEffectiveFontRule;
