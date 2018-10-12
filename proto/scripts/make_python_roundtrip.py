import os
import sys
import json
import lighthouse_result_pb2 as lhr_pb2
from proto_preprocessor import preproccess_json_lhr
from google.protobuf.json_format import Parse, MessageToJson

path = os.path.realpath(__file__)
path_dir = os.path.dirname(path)

def clean():
    try:
        os.remove(path_dir + '/../sample_v2_preprocessed.json')
    except OSError:
        pass

# clean workspace
clean()

# preprocess the sample json
sample = preproccess_json_lhr(path_dir + '/../../lighthouse-core/test/results/sample_v2.json')

# open json, and convert to proto
with open(sample, 'r') as f:
    data = json.load(f)

# make proto message
lhr = lhr_pb2.LighthouseResult()
Parse(json.dumps(data), lhr)

# convert proto back into json
round_trip_lhr = json.loads(MessageToJson(lhr, including_default_value_fields=False))

# write the output json
with open(path_dir + '/../' + 'sample_v2_round_trip.json', 'w') as f:
    json.dump(round_trip_lhr, f, indent=4, sort_keys=True)
