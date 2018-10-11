/**
 * @license Copyright 2018 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */
// @ts-nocheck
'use strict';

/**
 * Helper functions to transform an LHR into a proto-ready LHR
 */

/**
  * @param {string} result
  */
function processForProto(result) {
  const reportJson = JSON.parse(result);

  // clean up that requires audits to exist
  if ('audits' in reportJson) {
    // clean up audits
    Object.keys(reportJson.audits).forEach(audit => {
      // clean up score display modes
      if ('scoreDisplayMode' in reportJson.audits[audit]) {
        if (reportJson.audits[audit].scoreDisplayMode === 'not-applicable') {
          reportJson.audits[audit].scoreDisplayMode = 'not_applicable';
        }
      }
      // delete raw values
      if ('rawValue' in reportJson.audits[audit]) {
        delete reportJson.audits[audit].rawValue;
      }
      // clean up display values
      if ('displayValue' in reportJson.audits[audit]) {
        if (Array.isArray(reportJson.audits[audit]['displayValue'])) {
          const values = [];
          reportJson.audits[audit]['displayValue'].forEach(item => {
            values.push(item);
          });
          reportJson.audits[audit]['displayValue'] = values.join(' | ');
        }
      }
    });
  }

  // delete i18n icuMsg paths
  if ('i18n' in reportJson && 'icuMessagePaths' in reportJson.i18n) {
    delete reportJson.i18n.icuMessagePaths;
  }

  // remove empty strings
  (function removeStrings(obj) {
    if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
      Object.keys(obj).forEach(key => {
        if (typeof obj[key] === 'string' && obj[key] === '') {
          delete obj[key];
        } else if (typeof obj[key] === 'object' || Array.isArray(obj[key])) {
          removeStrings(obj[key]);
        }
      });
    } else if (Array.isArray(obj)) {
      obj.forEach(item => {
        if (typeof item === 'object' || Array.isArray(item)) {
          removeStrings(item);
        }
      });
    }
  })(reportJson);

  return JSON.stringify(reportJson);
}

module.exports = {
  processForProto,
};
