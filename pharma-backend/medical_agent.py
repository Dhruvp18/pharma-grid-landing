from agno.agent import Agent
from agno.models.google import Gemini
from agno.tools.duckduckgo import DuckDuckGoTools
import os
from dotenv import load_dotenv

load_dotenv()

# Get API Key
GOOGLE_API_KEY = os.getenv("VITE_GEMINI_API_KEY")

if not GOOGLE_API_KEY:
    raise ValueError("GEMINI_API_KEY is not set in .env")

# Initialize the Medical Agent
medical_agent = Agent(
    model=Gemini(id="gemini-flash-latest", api_key=GOOGLE_API_KEY),
    tools=[DuckDuckGoTools()],
    description="You are a trusted medical assistant AI for Pharma-Grid.",
    instructions=[
        "You have two modes: 'Device Expert' and 'General Health Assistant'.",
        "If the user provides 'Context' about a specific medical device, assume the role of an expert operator for that device.",
        "   - Prioritize safety instructions.",
        "   - Use the search tool to find user manuals or specific operating steps if unsure.",
        "   - Explain technical terms simply.",
        "If no specific device context is provided, act as a helpful general health assistant.",
        "   - Answer general medical questions cautiously.",
        "   - Always include a disclaimer: 'I am an AI, not a doctor. Please consult a professional for medical advice.'",
        "   - Use the search tool to verify symptoms or recent medical guidelines if needed.",
        "Be concise, empathetic, and clear."
    ],
    markdown=True
)

def get_agent_response(message: str, context: dict = None):
    """
    Generates a response from the medical agent.
    
    Args:
        message (str): The user's query.
        context (dict): Optional context about the device (name, model, etc.)
    """
    prompt = f"User Query: {message}\n"
    
    if context:
        prompt += f"\n--- SYSTEM INSTRUCTION ---\n"
        prompt += f"You are acting as an EXPERT DEVICE COMPANION for the following equipment:\n"
        prompt += f"Name: {context.get('device_name', 'Unknown')}\n"
        prompt += f"Category: {context.get('category', 'Unknown')}\n"
        
        description = context.get('description')
        if description:
             prompt += f"Description/Specs: {description}\n"
             
        images = context.get('images')
        if images and isinstance(images, list):
            prompt += f"Image Links (Ref only): {', '.join(images[:2])}\n"
            
        prompt += f"Instructions: Provide safe, clear, and step-by-step operating instructions for this specific device. "
        prompt += f"If the user asks about something not in the description, use your general knowledge about this model/type but act as if you know THIS specific unit."
        prompt += f"\n--------------------------\n"

    # Run the agent
    response = medical_agent.run(prompt)
    return response.content
