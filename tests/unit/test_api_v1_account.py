# -*- coding: utf-8 -*-
# SPDX-License-Identifier: GPL-3.0-or-later
"""Unit tests for /api/v1 account — auth gating, password-change verification,
and profile validation. DB writes are mocked; the focus is the endpoint logic.
"""
import inspect
import json
import flask
import pytest
from types import SimpleNamespace
from unittest.mock import patch, MagicMock


def _ctx(path, method="POST", body=None):
    app = flask.Flask(__name__)
    app.config["WTF_CSRF_ENABLED"] = False
    kwargs = {"method": method}
    if body is not None:
        kwargs["json"] = body
        kwargs["content_type"] = "application/json"
    return app.test_request_context(path, **kwargs)


def _user(**kw):
    defaults = dict(
        is_authenticated=True, is_anonymous=False,
        name="maggie", email="m@example.com", kindle_mail="",
        locale="en", default_language="all", password="HASH",
        role_admin=lambda: False, role_passwd=lambda: True,
        role_upload=lambda: False, role_edit=lambda: False,
        role_download=lambda: True, role_delete_books=lambda: False,
        role_edit_shelfs=lambda: True, role_viewer=lambda: True,
    )
    defaults.update(kw)
    return SimpleNamespace(**defaults)


# ── auth gating ──────────────────────────────────────────────────────────────

@pytest.mark.unit
def test_account_anonymous_401():
    from cps.api import account as mod
    with _ctx("/api/v1/account", method="GET"):
        with patch.object(mod, "current_user",
                          SimpleNamespace(is_authenticated=False, is_anonymous=True)):
            resp = inspect.unwrap(mod.get_account)()
    assert resp[1] == 401


# ── password change ──────────────────────────────────────────────────────────

@pytest.mark.unit
def test_password_change_wrong_current_400():
    from cps.api import account as mod
    with _ctx("/api/v1/account/password", body={"current_password": "nope", "new_password": "Newpass123"}):
        with patch.object(mod, "current_user", _user()), \
             patch.object(mod, "check_password_hash", return_value=False):
            resp = inspect.unwrap(mod.change_password)()
    assert resp[1] == 400
    assert json.loads(resp[0].get_data())["error"]["code"] == "invalid_credentials"


@pytest.mark.unit
def test_password_change_policy_fail_400():
    from cps.api import account as mod
    with _ctx("/api/v1/account/password", body={"current_password": "ok", "new_password": "weak"}):
        with patch.object(mod, "current_user", _user()), \
             patch.object(mod, "check_password_hash", return_value=True), \
             patch.object(mod, "valid_password", side_effect=Exception("Password too weak")):
            resp = inspect.unwrap(mod.change_password)()
    assert resp[1] == 400
    assert "weak" in json.loads(resp[0].get_data())["error"]["message"].lower()


@pytest.mark.unit
def test_password_change_forbidden_when_no_passwd_role():
    from cps.api import account as mod
    user = _user(role_passwd=lambda: False, role_admin=lambda: False)
    with _ctx("/api/v1/account/password", body={"current_password": "ok", "new_password": "Newpass123"}):
        with patch.object(mod, "current_user", user):
            resp = inspect.unwrap(mod.change_password)()
    assert resp[1] == 403


@pytest.mark.unit
def test_password_change_success_204():
    from cps.api import account as mod
    user = _user()
    mock_session = MagicMock()
    with _ctx("/api/v1/account/password", body={"current_password": "ok", "new_password": "Newpass123"}):
        with patch.object(mod, "current_user", user), \
             patch.object(mod, "check_password_hash", return_value=True), \
             patch.object(mod, "valid_password", return_value="Newpass123"), \
             patch.object(mod, "generate_password_hash", return_value="NEWHASH"), \
             patch.object(mod, "ub", SimpleNamespace(session=mock_session)):
            resp = inspect.unwrap(mod.change_password)()
    assert resp[1] == 204
    assert user.password == "NEWHASH"
    assert mock_session.commit.called


# ── profile update ───────────────────────────────────────────────────────────

@pytest.mark.unit
def test_profile_update_invalid_email_400():
    from cps.api import account as mod
    user = _user()
    with _ctx("/api/v1/account/profile", body={"email": "bogus"}):
        with patch.object(mod, "current_user", user), \
             patch.object(mod, "valid_email", side_effect=Exception("Invalid Email address format")), \
             patch.object(mod, "ub", SimpleNamespace(session=MagicMock())):
            resp = inspect.unwrap(mod.update_profile)()
    assert resp[1] == 400


@pytest.mark.unit
def test_profile_update_locale_and_language():
    from cps.api import account as mod
    user = _user()
    mock_session = MagicMock()
    with _ctx("/api/v1/account/profile", body={"locale": "de", "default_language": "eng"}):
        with patch.object(mod, "current_user", user), \
             patch.object(mod, "ub", SimpleNamespace(session=mock_session)), \
             patch.object(mod, "calibre_db", SimpleNamespace(speaking_language=lambda: [])), \
             patch.object(mod, "get_available_locale", return_value=[]), \
             patch.object(mod, "_", lambda s: s):  # flask_babel not initialized on the bare test app
            resp = inspect.unwrap(mod.update_profile)()
    # returns the serialized account (a Response, 200)
    assert user.locale == "de"
    assert user.default_language == "eng"
    assert mock_session.commit.called
