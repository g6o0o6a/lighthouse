## How to compile protos + use locally

1. Get the latest proto [release](https://github.com/protocolbuffers/protobuf/releases) (select one with python included if you want to run this validator)
1. Install the [C++ Protocol Buffer Runtime](https://github.com/protocolbuffers/protobuf/blob/master/src/README.md)
1. Run `yarn compile-proto` or run the commands seperately:
    1. Compile proto python definitions
        ```bash
            cd ./proto
            protoc --python_out=./ lighthouse-response.proto
        ```
    1. Run python round trip test
        ```bash
            python proto_lhr_validator.py
        ```

## Proto Resources
- [Protobuf Github Repo](https://github.com/protocolbuffers/protobuf) 
- [Protobuf Docs](https://developers.google.com/protocol-buffers/docs/overview)

## Hacking Hints
- Clean out compiled proto and json with `yarn clean`
- Round trips might jumble the order of your JSON keys and lists!
- Is your `six` installation troubling your `pip install protobuf`? Mine did.  Try `pip install --ignore-installed six`.