compile proto python definitions
```bash
    protoc --python_out=./ lighthouse-response.proto
```
run python round trip test
```bash
    python proto_lhr_validator.py
```