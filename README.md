# Python FastAPI on Vercel

This is a Python FastAPI application designed to be deployed on Vercel's serverless platform.

## Local Development

1. Create a virtual environment:
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: .\venv\Scripts\activate
   ```

2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

3. Run the development server:
   ```bash
   uvicorn app.api:app --reload
   ```

4. Open your browser to http://localhost:8000/api/hello

## Deployment to Vercel

1. Install Vercel CLI (if not already installed):
   ```bash
   npm install -g vercel
   ```

2. Deploy:
   ```bash
   vercel
   ```

3. Follow the prompts to complete the deployment.

## API Endpoints

- `GET /api/hello` - Returns a welcome message

## Project Structure

- `app/api.py` - Main FastAPI application
- `vercel.json` - Vercel configuration
- `requirements.txt` - Python dependencies
