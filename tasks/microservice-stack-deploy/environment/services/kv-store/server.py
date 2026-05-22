"""gRPC KV Store Server."""

import os
import sys
from concurrent import futures

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import grpc
import kvstore_pb2
import kvstore_pb2_grpc

DEFAULT_PORT = os.environ.get("KV_STORE_PORT", "50052")


class KVStoreServicer(kvstore_pb2_grpc.KVStoreServicer):
    def __init__(self):
        self._store = {}

    def Get(self, request, context):
        key = request.key
        if key in self._store:
            return kvstore_pb2.GetResponse(key=key, value=self._store[key], found=True)
        return kvstore_pb2.GetResponse(key=key, value="", found=False)

    def Set(self, request, context):
        self._store[request.key] = request.value
        return kvstore_pb2.SetResponse(success=True)

    def Delete(self, request, context):
        if request.key in self._store:
            del self._store[request.key]
            return kvstore_pb2.DeleteResponse(success=True)
        return kvstore_pb2.DeleteResponse(success=False)

    def Health(self, request, context):
        return kvstore_pb2.HealthResponse(status="ok")


def serve():
    port = DEFAULT_PORT
    server = grpc.server(futures.ThreadPoolExecutor(max_workers=10))
    kvstore_pb2_grpc.add_KVStoreServicer_to_server(KVStoreServicer(), server)
    server.add_insecure_port(f"[::]:{port}")
    server.start()
    print(f"KV Store gRPC server started on port {port}")
    server.wait_for_termination()


if __name__ == "__main__":
    serve()
