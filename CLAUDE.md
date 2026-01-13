# Project Description

This project is a simple single page web application that allows users to explore datasets from a Trino backend in the browser. It uses Perspective grid as well as Mosaic with embedded DuckDB to achieve this. Additionally, it supports Malloy for higher level querying, visualization and particularly reusability of data models and metrics.

## Technologies and layout

- Frontend: Svelte with SvelteKit
- Backend: Python server.py in backend folder (this is a sample)
- Database: Trino (not included in this repo)

## Claude Instructions

- No need to run `npm run dev` to check the frontend. You can run `npm run build` to check for errors in the frontend.
- `npm run build` needs to be run with extended memory, e.g. `export NODE_OPTIONS="--max-old-space-size=8192"`
