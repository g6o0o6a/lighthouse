/**
 * @license Copyright 2017 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */
'use strict';

const path = require('path');
const fs = require('fs');

const sample = fs.readFileSync(path.resolve(__dirname, '../results/sample_v2.json'));
const roundTripJson = require('../../../proto/sample_v2_round_trip');

/* eslint-env jest */

const preprocess = function(sampleJson) {
  // clean up audits
  Object.keys(sampleJson.audits).forEach(audit => {
    // clean up score display modes
    if ('scoreDisplayMode' in sampleJson.audits[audit]) {
      if (sampleJson.audits[audit].scoreDisplayMode === 'not-applicable') {
        sampleJson.audits[audit].scoreDisplayMode = 'not_applicable';
      }
    }
    // delete raw values
    if ('rawValue' in sampleJson.audits[audit]) {
      delete sampleJson.audits[audit].rawValue;
    }
    // clean up display values
    if ('displayValue' in sampleJson.audits[audit]) {
      if (Array.isArray(sampleJson.audits[audit]['displayValue'])) {
        const values = [];
        sampleJson.audits[audit]['displayValue'].forEach(item => {
          values.push(item);
        });
        sampleJson.audits[audit]['displayValue'] = values.join(' | ');
      }
    }
  });

  // delete i18n icuMsg paths
  delete sampleJson.i18n.icuMessagePaths;

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
  })(sampleJson);
};


describe('round trip JSON comparison subsets', () => {
  let sampleJson;

  beforeEach(() => {
    sampleJson = JSON.parse(sample);
    preprocess(sampleJson);
  });

  it('has the same audit results sans details', () => {
    Object.keys(sampleJson.audits).forEach(audit => {
      delete sampleJson.audits[audit].details;
    });

    expect(roundTripJson.audits).toMatchObject(sampleJson.audits);
  });

  it('has the same i18n rendererFormattedStrings', () => {
    expect(roundTripJson.i18n).toMatchObject(sampleJson.i18n);
  });

  it('has the same top level values', () => {
    Object.keys(sampleJson).forEach(audit => {
      if (typeof sampleJson[audit] === 'object' && !Array.isArray(sampleJson[audit])) {
        delete sampleJson[audit];
      }
    });

    expect(roundTripJson).toMatchObject(sampleJson);
  });

  it('has the same config values', () => {
    expect(roundTripJson.configSettings).toMatchObject(sampleJson.configSettings);
  });
});

describe('round trip JSON comparison to everything', () => {
  let sampleJson;

  beforeEach(() => {
    sampleJson = JSON.parse(sample);
    preprocess(sampleJson);
  });

  it('has the same JSON overall sans details', () => {
    Object.keys(sampleJson.audits).forEach(audit => {
      delete sampleJson.audits[audit].details;
    });

    expect(roundTripJson).toMatchObject(sampleJson);
  });
});
