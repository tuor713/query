# Trino Data Explorer

A local-first web app for exploring datasets from Trino/Starburst. Uses [Perspective.js](https://perspective-dev.github.io/) for high-performance grids. 

It includes a bunch of experimental features such as querying in Malloy[https://www.malloydata.dev/] and Wvlet[https://wvlet.org/] as well as supporting Mosaic[https://idl.uw.edu/mosaic/] and finally an AI chat.

## Quick Start

### Backend

Requires a Trino server running on `localhost:8080`.

```bash
cd backend
pip install -r requirements.txt
python server.py
```

### Frontend

```bash
npm install
npm run dev
```

Visit frontend at `http://localhost:5173/`.

## Build

```bash
export NODE_OPTIONS="--max-old-space-size=8192"
npm run build
```
