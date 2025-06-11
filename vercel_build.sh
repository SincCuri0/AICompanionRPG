#!/bin/bash

# Install Python dependencies
pip install -r requirements.txt

# Create __init__.py in the app directory if it doesn't exist
mkdir -p app
touch app/__init__.py
