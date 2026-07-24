import pytest
from backend.app.models.user import User
from backend.app.auth.security import get_password_hash

def test_login_success(client, db):
    # Create test admin
    hashed = get_password_hash("testpassword123")
    user = User(username="testadmin", hashed_password=hashed, is_active=True)
    db.add(user)
    db.commit()
    
    # Attempt login
    response = client.post(
        "/api/auth/login",
        data={"username": "testadmin", "password": "testpassword123"}
    )
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"

def test_login_invalid_password(client, db):
    hashed = get_password_hash("testpassword123")
    user = User(username="testadmin", hashed_password=hashed, is_active=True)
    db.add(user)
    db.commit()
    
    response = client.post(
        "/api/auth/login",
        data={"username": "testadmin", "password": "wrongpassword"}
    )
    assert response.status_code == 401

def test_change_password(client, db):
    hashed = get_password_hash("testpassword123")
    user = User(username="testadmin", hashed_password=hashed, is_active=True)
    db.add(user)
    db.commit()
    
    # Login to get token
    login_response = client.post(
        "/api/auth/login",
        data={"username": "testadmin", "password": "testpassword123"}
    )
    token = login_response.json()["access_token"]
    
    # Change password
    headers = {"Authorization": f"Bearer {token}"}
    change_response = client.post(
        "/api/auth/change-password",
        json={"old_password": "testpassword123", "new_password": "newsecurepassword456"},
        headers=headers
    )
    assert change_response.status_code == 200
    assert change_response.json()["message"] == "Password changed successfully"
    
    # Try logging in with old password (should fail)
    response = client.post(
        "/api/auth/login",
        data={"username": "testadmin", "password": "testpassword123"}
    )
    assert response.status_code == 401
    
    # Try logging in with new password (should succeed)
    response = client.post(
        "/api/auth/login",
        data={"username": "testadmin", "password": "newsecurepassword456"}
    )
    assert response.status_code == 200
