from google import genai

client = genai.Client()

response = client.models.generate_content(
    model="gemini-2.5-flash",
    contents=input("give genai a prompt: "),
)

print(response.text)