import json
import inspect
import pytest
import flask
from types import SimpleNamespace
from unittest.mock import patch


@pytest.mark.unit
def test_books_list_envelope():
    from cps.api import books as books_mod
    from cps.pagination import Pagination
    bks = [SimpleNamespace(id=1, title="A", series_index="1.0", has_cover=1,
                           authors=[SimpleNamespace(name="Auth")], series=[],
                           data=[SimpleNamespace(format="EPUB")])]
    pag = Pagination(1, 60, 1)
    app = flask.Flask(__name__)
    with app.test_request_context("/api/v1/books?page=1"):
        with patch.object(books_mod.calibre_db, "fill_indexpage",
                          return_value=(bks, None, pag)), \
             patch.object(books_mod.config, "config_books_per_page", 60, create=True), \
             patch.object(books_mod.config, "config_read_column", 0, create=True):
            view = inspect.unwrap(books_mod.list_books)  # strip @login_required_if_no_ano
            resp = view()
    data = json.loads(resp.get_data(as_text=True))
    assert data["total"] == 1
    assert data["page"] == 1
    assert data["per_page"] == 60
    assert data["items"][0]["title"] == "A"
    assert data["items"][0]["cover_url"] == "/cover/1/sm"
