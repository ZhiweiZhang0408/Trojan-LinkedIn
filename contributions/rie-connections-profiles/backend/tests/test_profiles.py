from conftest import find_alumni, user_id


def test_get_my_profile(client, student):
    r = client.get("/profiles/me", headers=student)
    assert r.status_code == 200
    body = r.json()
    assert body["is_me"] and body["role"] == "student"
    assert body["email"] == "alex.chen@student.example.com"
    assert body["student"]["major"] == "Computer Science"
    assert body["alumni"] is None


def test_student_edits_own_profile(client, student):
    r = client.put(
        "/profiles/me",
        headers=student,
        json={"career_interests": ["Software Engineering", "Machine Learning & AI", "software engineering"],
              "target_roles": ["Software Engineer"], "bio": "Updated bio",
              "linkedin_url": "https://www.linkedin.com/in/example-alex"},
    )
    assert r.status_code == 200, r.text
    s = r.json()["student"]
    assert s["career_interests"] == ["Software Engineering", "Machine Learning & AI"]  # deduped
    assert s["target_roles"] == ["Software Engineer"]
    assert s["bio"] == "Updated bio"
    assert s["major"] == "Computer Science"  # untouched fields keep their value


def test_profile_validation(client, student):
    assert client.put("/profiles/me", headers=student, json={"linkedin_url": "javascript:alert(1)"}).status_code == 422
    assert client.put("/profiles/me", headers=student, json={"graduation_year": 1800}).status_code == 422
    # Alumni-only fields are rejected for students
    r = client.put("/profiles/me", headers=student, json={"current_company": "Somewhere"})
    assert r.status_code == 422


def test_alumni_edits_own_profile(client, alumni):
    r = client.put("/profiles/me", headers=alumni,
                   json={"coffee_chat_available": False, "current_title": "Staff Software Engineer"})
    assert r.status_code == 200
    a = r.json()["alumni"]
    assert a["coffee_chat_available"] is False and a["current_title"] == "Staff Software Engineer"
    assert client.put("/profiles/me", headers=alumni, json={"major": "CS"}).status_code == 422


def test_cannot_edit_another_users_profile(client, student, alumni):
    alumni_id = user_id(client, alumni)
    # There is no write endpoint for other users' profiles.
    assert client.put(f"/profiles/{alumni_id}", headers=student, json={"bio": "hacked"}).status_code == 405
    assert client.patch(f"/profiles/{alumni_id}", headers=student, json={"bio": "hacked"}).status_code == 405
    # PUT /profiles/me only ever touches the caller.
    client.put("/profiles/me", headers=student, json={"bio": "mine"})
    assert client.get(f"/profiles/{alumni_id}", headers=student).json()["alumni"]["bio"] != "mine"


def test_view_other_profile_hides_email(client, student):
    sarah = find_alumni(client, student, "Sarah Kim")
    r = client.get(f"/profiles/{sarah['user_id']}", headers=student)
    assert r.status_code == 200
    body = r.json()
    assert body["is_me"] is False and body["email"] is None
    assert body["alumni"]["current_company"] == "Brightline Cloud"
    assert client.get("/profiles/99999", headers=student).status_code == 404


def test_profiles_require_auth(client):
    assert client.get("/profiles/me").status_code == 401
    assert client.put("/profiles/me", json={"bio": "x"}).status_code == 401
    assert client.get("/profiles/1").status_code == 401
