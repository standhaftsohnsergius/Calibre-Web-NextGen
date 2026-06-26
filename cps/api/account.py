# -*- coding: utf-8 -*-
# SPDX-License-Identifier: GPL-3.0-or-later
"""Self-service account endpoints for /api/v1 (the logged-in user's own profile).

Reuses the same validators the legacy /me form uses (valid_password applies the
configured password policy; valid_email/check_email validate + dedupe), so the
rules can't drift. Unlike the legacy form, the password change requires the
current password (defence against a hijacked session silently changing it) —
flag for /security-review before this branch merges.
"""
from flask import jsonify, request
from flask_babel import gettext as _
from werkzeug.security import check_password_hash, generate_password_hash

from . import api_v1
from .. import calibre_db, ub
from ..cw_login import current_user
from ..cw_babel import get_available_locale
from ..helper import valid_password, valid_email, check_email


def _err(code, message, status):
    return jsonify({"error": {"code": code, "message": message}}), status


def _require_real_user():
    """Account endpoints are for a concretely logged-in user — never the
    anonymous-browse guest. Returns an error response, or None when ok."""
    if not current_user.is_authenticated or current_user.is_anonymous:
        return _err("unauthorized", "You must be signed in", 401)
    return None


def _serialize_account():
    locales = [{"id": str(loc), "name": loc.display_name} for loc in get_available_locale()]
    languages = calibre_db.speaking_language()  # sets .name to the display name
    lang_options = [{"id": "all", "name": _("Show All")}]
    lang_options += [{"id": l.lang_code, "name": l.name} for l in languages]
    return {
        "name": current_user.name,
        "email": current_user.email or "",
        "kindle_mail": current_user.kindle_mail or "",
        "locale": current_user.locale,
        "default_language": current_user.default_language,
        "role": {
            "admin": current_user.role_admin(),
            "upload": current_user.role_upload(),
            "edit": current_user.role_edit(),
            "download": current_user.role_download(),
            "delete_books": current_user.role_delete_books(),
            "edit_shelfs": current_user.role_edit_shelfs(),
            "viewer": current_user.role_viewer(),
            "passwd": current_user.role_passwd(),
        },
        "can_change_password": bool(current_user.role_passwd() or current_user.role_admin()),
        # Picker options for the settings form.
        "locales": locales,
        "languages": lang_options,
    }


@api_v1.route("/account")
def get_account():
    guard = _require_real_user()
    if guard:
        return guard
    return jsonify(_serialize_account())


@api_v1.route("/account/profile", methods=["POST"])
def update_profile():
    guard = _require_real_user()
    if guard:
        return guard
    data = request.get_json(silent=True) or {}

    try:
        if "email" in data:
            new_email = valid_email(data.get("email") or "")
            if not new_email:
                return _err("invalid_request", "Email can't be empty", 400)
            if new_email != current_user.email:
                # check_email raises if the address is already taken
                current_user.email = check_email(new_email)
        if "kindle_mail" in data:
            current_user.kindle_mail = valid_email(data.get("kindle_mail") or "")
        if "locale" in data and data["locale"]:
            current_user.locale = data["locale"]
        if "default_language" in data and data["default_language"]:
            current_user.default_language = data["default_language"]
    except Exception as ex:  # validators raise generic Exception with a message
        ub.session.rollback()
        return _err("invalid_request", str(ex), 400)

    try:
        ub.session.commit()
    except Exception as ex:
        ub.session.rollback()
        return _err("db_error", "Could not save profile: %s" % ex, 500)

    return jsonify(_serialize_account())


@api_v1.route("/account/password", methods=["POST"])
def change_password():
    guard = _require_real_user()
    if guard:
        return guard
    if not (current_user.role_passwd() or current_user.role_admin()):
        return _err("forbidden", "You are not allowed to change your password", 403)

    data = request.get_json(silent=True) or {}
    current_password = data.get("current_password") or ""
    new_password = data.get("new_password") or ""

    # Verify the current password — never let a session change the password blind.
    if not current_user.password or not check_password_hash(current_user.password, current_password):
        return _err("invalid_credentials", "Current password is incorrect", 400)

    try:
        validated = valid_password(new_password)  # enforces the configured policy
    except Exception as ex:
        return _err("invalid_request", str(ex), 400)

    current_user.password = generate_password_hash(validated)
    try:
        ub.session.commit()
    except Exception as ex:
        ub.session.rollback()
        return _err("db_error", "Could not change password: %s" % ex, 500)

    return "", 204
