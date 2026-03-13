"""
Test script to verify Google Meet API integration
"""
from meet_api import get_latest_conference, get_conference_participants

print("Testing Google Meet API...")
print("-" * 50)

# Test 1: Get latest conference
print("\n1. Getting latest conference...")
conf = get_latest_conference()
if conf:
    print(f"✓ Conference found: {conf['conference_id']}")
    print(f"  Space ID: {conf['space_id']}")
    print(f"  Started: {conf['started_at']}")
    
    # Test 2: Get participants
    print(f"\n2. Getting participants for {conf['conference_id']}...")
    participants = get_conference_participants(conf['conference_id'])
    if participants:
        print(f"✓ Found {len(participants)} participant(s):")
        for i, name in enumerate(participants, 1):
            print(f"  {i}. {name}")
    else:
        print("✗ No participants found")
else:
    print("✗ No conference found")
    print("  Make sure:")
    print("  - You have an active Google Meet session")
    print("  - The token.json has valid credentials")
    print("  - The Meet API is enabled in your Google Cloud project")

print("\n" + "-" * 50)
print("Test complete!")
