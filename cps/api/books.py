# -*- coding: utf-8 -*-
# SPDX-License-Identifier: GPL-3.0-or-later
"""Catalog endpoints for /api/v1."""
from flask import jsonify, request

from . import api_v1
from .serializers import serialize_book_list_item
from .. import calibre_db, config, db
from ..usermanagement import login_required_if_no_ano


@api_v1.route("/books")
@login_required_if_no_ano
def list_books():
    page = request.args.get("page", 1, type=int)
    per_page = request.args.get("per_page", config.config_books_per_page, type=int)
    entries, _random, pagination = calibre_db.fill_indexpage(
        page, per_page, db.Books, True, [db.Books.timestamp.desc()],
        True, config.config_read_column,
    )
    return jsonify({
        "items": [serialize_book_list_item(b) for b in entries],
        "page": pagination.page,
        "per_page": pagination.per_page,
        "total": pagination.total_count,
    })
