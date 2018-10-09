import os
import json

path = os.path.realpath(__file__)
path_dir = os.path.dirname(path)


def preproccess_json_lhr(file, output=None):

    with open(file, 'r') as f:
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
            # make lists into pipe-delimited strings
            if type(audit["displayValue"]) is list:
                new_list = []
                for item in audit["displayValue"]:
                    if type(audit["displayValue"]) is not unicode:
                        item = str(item)
                    new_list.append(item)
                audit["displayValue"] = (' | ').join(new_list)

    # delete i18n icuPaths
    del data['i18n']['icuMessagePaths']

    # remove empty strings
    def remove_empty_strings(obj):
        if type(obj) is dict:
            for key, val in obj.items():
                if type(val) is unicode:
                    if val == "":
                        del obj[key]
                elif type(val) is dict or type(val) is list:
                    remove_empty_strings(val)
        elif type(obj) is list:
            for item in obj:
                if type(item) is dict or type(item) is list:
                    remove_empty_strings(item)

    remove_empty_strings(data)


    # set a default output filename
    if not output:
        output = path_dir + '/' + os.path.splitext(os.path.basename(file))[0] + '_processed.json'

    # write the file
    with open(output, 'w') as f:
        json.dump(data, f, indent=4, sort_keys=True) 

    return output