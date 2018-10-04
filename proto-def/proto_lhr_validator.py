import os
import sys
import json
import lighthouse_response_pb2 as lhr_pb2
from google.protobuf.json_format import Parse, MessageToJson

cleaned_name = 'lhr_cleaned.json'

def clean():
    try:
        os.remove(cleaned_name)
    except OSError:
        pass

def make_cleaned_sample_json(output_filename='lhr_cleaned.json'):
    with open('../lighthouse-core/test/results/sample_v2.json', 'r') as f:
        data = json.load(f)

    # convert scoreDisplayMode
    audits = data["audits"]

    for audit_id, audit in audits.items():
        if "scoreDisplayMode" in audit:
            if audit["scoreDisplayMode"] == "not-applicable":
                audit["scoreDisplayMode"] = "not_applicable"

    # remove rawValue
    for audit_id, audit in audits.items():
        if "rawValue" in audit:
            del audit["rawValue"]

    # clean up displayValue to be only strings
    for audit_id, audit in audits.items():
        if "displayValue" in audit:
            if type(audit["displayValue"]) is list:
                new_list = []
                for item in audit["displayValue"]:
                    if type(audit["displayValue"]) is not unicode:
                        item = str(item)
                    new_list.append(item)
                audit["displayValue"] = new_list
            else:
                audit["displayValue"] = [audit["displayValue"]]

    # convert i18n -> EXPERIMENTALI18n
    data['EXPERIMENTALI18n'] = data['i18n']
    del data['i18n']
    
    with open(output_filename, 'w') as f:
        json.dump(data, f, indent=4)

clean()

make_cleaned_sample_json()

# get json file
with open('lhr_cleaned.json', 'r') as f:
    data = json.load(f)

# convert string to proto object
lhr = lhr_pb2.LighthouseResponse()
Parse(json.dumps(data), lhr)

# write proto object to console
json_lhr = json.loads(MessageToJson(lhr))

# validate naive truth
print(json_lhr == data) # is false b/c defaults!!!

with open('lhr_round_trip.json', 'w') as f:
    json.dump(json.loads(MessageToJson(lhr)), f, indent=4)
