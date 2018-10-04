import sys
import json
import lighthouse_response_pb2 as lhr_pb2
from google.protobuf.json_format import Parse, MessageToJson


# get json file
with open('lhr_example_pruned.json', 'r') as f:
    data = json.load(f)

# convert string to proto object
lhr = lhr_pb2.LighthouseResponse()

Parse(json.dumps(data), lhr)

# write proto object to console
print(lhr)

# validate naive truth
print(json.loads(MessageToJson(lhr)) == data) # is false b/c defaults!!!