import os
import sys
import json
import lighthouse_response_pb2 as lhr_pb2
from google.protobuf.json_format import Parse, MessageToJson

cleaned_name = 'lhr_cleaned.json'

path = os.path.realpath(__file__)
path_dir = os.path.dirname(path)

def clean():
    try:
        os.remove(cleaned_name)
    except OSError:
        pass

def make_cleaned_sample_json(output_filename='lhr_cleaned.json'):

    # get the parent directory 
    dir_path = os.path.dirname(os.path.dirname(path))

    with open(dir_path + '/lighthouse-core/test/results/sample_v2.json', 'r') as f:
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

    # convert i18n -> i18nV1
    data['i18nV1'] = data['i18n']
    del data['i18n']
    
    # convert the icu message path objects to standard objects instead of strs or objects
    for key, icuMessages in data['i18nV1']['icuMessagePaths'].items():
        # if the messages are strs then we need to convert them to objects
        if type(icuMessages[0]) is not dict:
            new_messages = []
            for message in icuMessages:
                new_messages.append({
                    'path': message,
                })
            data['i18nV1']['icuMessagePaths'][key] = new_messages
        #     data['i18nV1']['icuMessagePaths'][key] = {'values':new_messages}
        # else:
        #     data['i18nV1']['icuMessagePaths'][key] = {'values':icuMessages}
        
    with open(path_dir + '/' + output_filename, 'w') as f:
        json.dump(data, f, indent=4)

clean()

make_cleaned_sample_json()

# get json file
with open(path_dir + '/' + 'lhr_cleaned.json', 'r') as f:
    data = json.load(f)

# convert string to proto object
lhr = lhr_pb2.LighthouseResponse()
Parse(json.dumps(data), lhr)

# print(lhr.config_settings)

# print(lhr.config_settings.gather_mode)

# write proto object to console
json_lhr = json.loads(MessageToJson(lhr, including_default_value_fields=True))

# validate naive truth
print(json_lhr == data) # is false b/c defaults!!!

with open(path_dir + '/' + 'lhr_round_trip.json', 'w') as f:
    json.dump(json_lhr, f, indent=4)

