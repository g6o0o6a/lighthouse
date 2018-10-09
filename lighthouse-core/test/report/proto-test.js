/**
 * @license Copyright 2017 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */
'use strict';

const sampleJson = require('../../../proto/sample_v2_processed');
const roundTripJson = require('../../../proto/sample_v2_round_trip');

/* eslint-env jest */

describe('round-trip JSON comparison', () => {
  it('has the same JSON', () => {
    // TODO make this work!
    expect(sampleJson).toEqual(roundTripJson);
  });
});
