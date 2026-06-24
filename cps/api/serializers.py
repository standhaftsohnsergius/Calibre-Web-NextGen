# -*- coding: utf-8 -*-
# SPDX-License-Identifier: GPL-3.0-or-later
"""Pure (context-free) JSON serializers for the /api/v1 surface."""


def serialize_user(user):
    return {
        "id": user.id,
        "name": user.name,
        "locale": user.locale,
        "theme": user.theme,
        "role": {
            "admin": user.role_admin(),
            "upload": user.role_upload(),
            "edit": user.role_edit(),
            "download": user.role_download(),
            "delete_books": user.role_delete_books(),
            "edit_shelfs": user.role_edit_shelfs(),
            "viewer": user.role_viewer(),
            "passwd": user.role_passwd(),
        },
    }


def serialize_book_list_item(book):
    series = book.series[0].name if getattr(book, "series", None) else None
    return {
        "id": book.id,
        "title": book.title,
        "authors": [a.name for a in book.authors] if getattr(book, "authors", None) else [],
        "series": series,
        "series_index": book.series_index,
        "cover_url": f"/cover/{book.id}/sm" if getattr(book, "has_cover", 0) else None,
        "formats": [d.format for d in book.data] if getattr(book, "data", None) else [],
    }
