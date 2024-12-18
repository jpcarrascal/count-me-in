import asyncio
import websockets
import json


import websocket
import _thread
import time
import rel

# create handler for each connection
async def handler(websocket):
    while True:
        try:
            recData = await websocket.recv()
            dataObj = json.loads(recData)
            msg = dataObj['msg']
            data = dataObj['data']
            print(f"Message: {msg}, data: {data}!")
            if msg == "xy":
                print(f"xy received: {data}")
                reply = xy(1,1)
                print(reply)
            elif msg == "drum prompt":
                print(f"Prompt received: {data}")
                reply = drumPrompt(data)
                print(reply)
            # reply = f"Data received as: {data}!"
            # await websocket.send(reply)
        except websockets.ConnectionClosed:
            print(f"Terminated")
            break


async def main():
    async with websockets.serve(handler, "localhost", 8765):
        await asyncio.Future()  # run forever

def xy(x, y):
    return "Result: note array"

def drumPrompt(prompt):
    return "Result: drum sound URL"


asyncio.run(main())


### CLIENT SIDE ###
def on_message(ws, message):
    print(message)

def on_error(ws, error):
    print(error)

def on_close(ws, close_status_code, close_msg):
    print("### closed ###")

def on_open(ws):
    print("Opened connection")

if __name__ == "__main__":
    websocket.enableTrace(True)
    ws = websocket.WebSocketApp("wss://api.gemini.com/v1/marketdata/BTCUSD",
                              on_open=on_open,
                              on_message=on_message,
                              on_error=on_error,
                              on_close=on_close)

    ws.run_forever(dispatcher=rel, reconnect=5)  # Set dispatcher to automatic reconnection, 5 second reconnect delay if connection closed unexpectedly
    rel.signal(2, rel.abort)  # Keyboard Interrupt
    rel.dispatch()