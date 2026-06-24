import pytest
import flask
from unittest.mock import patch, MagicMock


def _app():
    from cps.api import api_v1
    app = flask.Flask(__name__)
    app.testing = True
    app.config["WTF_CSRF_ENABLED"] = False
    app.config["SECRET_KEY"] = "test"
    app.register_blueprint(api_v1)
    return app


@pytest.mark.unit
def test_csrf_returns_token_key():
    resp = _app().test_client().get("/api/v1/auth/csrf")
    assert resp.status_code == 200
    assert "csrf_token" in resp.get_json()


@pytest.mark.unit
def test_me_anonymous_401():
    app = _app()
    with patch("cps.api.auth.current_user") as cu:
        cu.is_authenticated = False
        resp = app.test_client().get("/api/v1/auth/me")
    assert resp.status_code == 401


@pytest.mark.unit
def test_me_authenticated_returns_user():
    app = _app()
    from cps import ub, constants
    u = ub.User()
    u.id, u.name, u.locale, u.theme = 5, "maggie", "en", 1
    u.role = constants.ROLE_USER
    with patch("cps.api.auth.current_user", u):
        resp = app.test_client().get("/api/v1/auth/me")
    assert resp.status_code == 200
    assert resp.get_json()["name"] == "maggie"


@pytest.mark.unit
def test_login_success():
    app = _app()
    from cps import ub, constants
    u = ub.User()
    u.id, u.name, u.password, u.locale, u.theme = 1, "admin", "hash", "en", 1
    u.role = constants.ROLE_ADMIN
    mock_session = MagicMock()
    mock_session.query.return_value.filter.return_value.first.return_value = u
    with patch("cps.api.auth.ub.session", mock_session), \
         patch("cps.api.auth.check_password_hash", return_value=True), \
         patch("cps.api.auth.login_user") as lu:
        resp = app.test_client().post("/api/v1/auth/login", json={"username": "admin", "password": "x"})
    assert resp.status_code == 200
    assert lu.called
    assert resp.get_json()["name"] == "admin"


@pytest.mark.unit
def test_login_bad_password_401():
    app = _app()
    from cps import ub, constants
    u = ub.User()
    u.name, u.password = "admin", "hash"
    u.role = constants.ROLE_ADMIN
    mock_session = MagicMock()
    mock_session.query.return_value.filter.return_value.first.return_value = u
    with patch("cps.api.auth.ub.session", mock_session), \
         patch("cps.api.auth.check_password_hash", return_value=False), \
         patch("cps.api.auth.login_user") as lu:
        resp = app.test_client().post("/api/v1/auth/login", json={"username": "admin", "password": "x"})
    assert resp.status_code == 401
    assert not lu.called


@pytest.mark.unit
def test_logout_204():
    app = _app()
    with patch("cps.api.auth.logout_user") as lo:
        resp = app.test_client().post("/api/v1/auth/logout")
    assert resp.status_code == 204
    assert lo.called
