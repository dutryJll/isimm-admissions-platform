import requests

API_BASE = "http://127.0.0.1:8003/api/candidatures"

def test_get_specialites():
    url = f"{API_BASE}/specialites/by-parcours/"
    print(f"Testing URL: {url}")
    try:
        response = requests.get(url)
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.text}")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    test_get_specialites()
