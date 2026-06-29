import asyncio
import websockets
import sys

async def test_websocket():
    uri = "ws://localhost:8003/ws/candidatures/"
    try:
        async with websockets.connect(uri) as websocket:
            print(f"✓ WebSocket connected to {uri}")
            await websocket.send("test message")
            print("✓ Message sent")
            try:
                response = await asyncio.wait_for(websocket.recv(), timeout=2)
                print(f"✓ Response received: {response}")
            except asyncio.TimeoutError:
                print("✓ WebSocket connection established, no immediate response (expected)")
    except Exception as e:
        print(f"✗ WebSocket error: {type(e).__name__}: {e}")

asyncio.run(test_websocket())
