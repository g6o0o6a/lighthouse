/**
 * @license Copyright 2017 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */
'use strict';

const path = require('path');
const fs = require('fs');

const sample = fs.readFileSync(path.resolve(__dirname, '../../../proto/sample_v2_processed.json'));
const roundTripJson = require('../../../proto/sample_v2_round_trip');

/* eslint-env jest */

describe('round-trip JSON comparison', () => {
  it('has the same audit results sans details', () => {
    const noDetails = JSON.parse(sample);

    Object.keys(noDetails.audits).forEach(audit => {
      delete noDetails.audits[audit].details;
    });

    expect(roundTripJson.audits).toMatchObject(noDetails.audits);
  });

  it('has the same i18n rendererFormattedStrings', () => {
    const noIcuMessagePaths = JSON.parse(sample);

    delete noIcuMessagePaths.i18n.icuMessagePaths;

    expect(roundTripJson.i18n).toMatchObject(noIcuMessagePaths.i18n);
  });

  it('has the same top level values', () => {
    const topLevelOnly = JSON.parse(sample);

    Object.keys(topLevelOnly).forEach(audit => {
      if (typeof topLevelOnly[audit] === 'object' && !Array.isArray(topLevelOnly[audit])) {
        delete topLevelOnly[audit];
      }
    });

    expect(roundTripJson).toMatchObject(topLevelOnly);
  });

  it('has the same config values', () => {
    const configOnly = JSON.parse(sample);

    expect(roundTripJson.configSettings).toMatchObject(configOnly.configSettings);
  });

  it('has the same JSON overall sans details', () => {
    const noDetails = JSON.parse(sample);

    Object.keys(noDetails.audits).forEach(audit => {
      delete noDetails.audits[audit].details;
    });

    expect(roundTripJson).toMatchObject(noDetails);
  });
});
