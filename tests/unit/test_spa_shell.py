import pytest
import flask


@pytest.mark.unit
def test_spa_disabled_404(monkeypatch):
    monkeypatch.delenv("CWNG_SPA", raising=False)
    from cps.spa import spa
    app = flask.Flask(__name__)
    app.register_blueprint(spa)
    assert app.test_client().get("/app").status_code == 404


@pytest.mark.unit
def test_spa_enabled_serves_shell(monkeypatch):
    monkeypatch.setenv("CWNG_SPA", "1")
    from cps.spa import spa
    app = flask.Flask(__name__)
    app.register_blueprint(spa)
    resp = app.test_client().get("/app")
    assert resp.status_code == 200
    assert b"NextGen" in resp.data


@pytest.mark.unit
@pytest.mark.parametrize("path", ["/app", "/app/", "/app/book/5", "/app/authors"])
def test_spa_serves_all_client_routes(monkeypatch, path):
    """The shell must answer /app, /app/ (trailing slash) and any deep client-side
    route, so a hard reload / shared link on any SPA path boots the app instead of
    hitting a server 404. Regression: /app/ previously 404'd because the
    /app/<path:path> rule doesn't match an empty path segment."""
    monkeypatch.setenv("CWNG_SPA", "1")
    from cps.spa import spa
    app = flask.Flask(__name__)
    app.register_blueprint(spa)
    resp = app.test_client().get(path)
    assert resp.status_code == 200, f"{path} should serve the SPA shell"
    assert b"NextGen" in resp.data
