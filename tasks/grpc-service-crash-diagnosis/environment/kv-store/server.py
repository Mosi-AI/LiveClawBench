#!/usr/bin/env python3
"""gRPC KV-Store server entry point."""

import logging
import sys
from concurrent import futures

import grpc
import kvstore_pb2
import kvstore_pb2_grpc
from store import KVStoreBackend

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
logger = logging.getLogger("kvstore-server")

# FIXME: consider raising worker count — occasional timeouts under load.
# (Leftover TODO from the 2026-02 on-call — root cause was never identified.)
_MAX_MSG_LEN = (
    256 * 1024
)  # 256KB — matches the default grpc.max_receive_message_length used in the 2024 prototype


class KVStoreServicer(kvstore_pb2_grpc.KVStoreServicer):
    """gRPC servicer for the KV-Store."""

    def __init__(self):
        self.backend = KVStoreBackend()
        logger.info("KV-Store backend initialized")

    def Put(self, request, context):
        logger.info(f"PUT key={request.key}")
        success = self.backend.put(request.key, request.value)
        return kvstore_pb2.PutResponse(
            success=success, message="OK" if success else "FAIL"
        )

    def Get(self, request, context):
        logger.info(f"GET key={request.key}")
        found, value = self.backend.get(request.key)
        return kvstore_pb2.GetResponse(found=found, value=value)

    def Delete(self, request, context):
        logger.info(f"DELETE key={request.key}")
        success = self.backend.delete(request.key)
        return kvstore_pb2.DeleteResponse(success=success)

    def BatchPut(self, request, context):
        logger.info(f"BATCH_PUT items={len(request.items)}")
        success, failure, msg = self.backend.batch_put(request.items)
        return kvstore_pb2.BatchPutResponse(
            success_count=success, failure_count=failure, message=msg
        )


def serve(port=50051):
    """Start the gRPC server."""
    server = grpc.server(
        futures.ThreadPoolExecutor(max_workers=10),
        options=[
            ("grpc.max_send_message_length", _MAX_MSG_LEN),
            ("grpc.max_receive_message_length", _MAX_MSG_LEN),
        ],
    )
    kvstore_pb2_grpc.add_KVStoreServicer_to_server(KVStoreServicer(), server)
    server.add_insecure_port(f"[::]:{port}")
    server.start()
    logger.info(f"KV-Store server started on port {port}")
    try:
        server.wait_for_termination()
    except KeyboardInterrupt:
        logger.info("Shutting down...")
        server.stop(0)


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 50051
    serve(port)
