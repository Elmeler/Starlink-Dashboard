"""Service / account information derived from the dish status protobuf."""

import asyncio
import logging
from typing import Optional

import starlink_grpc
from fastapi import APIRouter, HTTPException

from dish import telemetry

router  = APIRouter()
logger  = logging.getLogger(__name__)


def _enum_name(msg, field_name: str) -> Optional[str]:
    """Return the proto enum *name* for an integer enum field, or None."""
    try:
        val        = int(getattr(msg, field_name, 0))
        field_desc = msg.DESCRIPTOR.fields_by_name[field_name]
        return field_desc.enum_type.values_by_number[val].name
    except Exception:
        return None


def _str(v) -> Optional[str]:
    s = str(v).strip() if v is not None else ""
    return s or None


@router.get("/service")
async def get_service():
    """
    Account / plan information read from the dish status protobuf.
    Enum fields are resolved to their string names via the protobuf DESCRIPTOR.
    """
    try:
        raw = await asyncio.get_event_loop().run_in_executor(
            None,
            lambda: starlink_grpc.get_status(context=telemetry.get_context()),
        )
    except Exception as exc:
        raise HTTPException(status_code=503, detail=str(exc))

    device_info = getattr(raw, "device_info", None)
    sw_stats    = getattr(raw, "software_update_stats", None)
    reboot_ts   = int(getattr(sw_stats, "reboot_scheduled_utc_time", 0) or 0)

    return {
        # Plan / service class
        "class_of_service":  _enum_name(raw, "class_of_service"),
        "mobility_class":    _enum_name(raw, "mobility_class"),
        "disablement_code":  _enum_name(raw, "disablement_code"),

        # Bandwidth restriction reasons (0 / first enum value = not restricted)
        "dl_restricted_reason": _enum_name(raw, "dl_bandwidth_restricted_reason"),
        "ul_restricted_reason": _enum_name(raw, "ul_bandwidth_restricted_reason"),

        # Device identity
        "country_code":      _str(getattr(device_info, "country_code",    None)),
        "hardware_version":  _str(getattr(device_info, "hardware_version", None)),
        "software_version":  _str(getattr(device_info, "software_version", None)),
        "generation_number": int(getattr(device_info,  "generation_number", 0) or 0),

        # Software update
        "sw_update_state":          _enum_name(raw, "software_update_state"),
        "sw_update_reboot_required": bool(getattr(sw_stats, "update_requires_reboot", False)),
        "sw_update_reboot_ts":      reboot_ts if reboot_ts > 0 else None,
        "sw_update_progress":       float(getattr(sw_stats, "software_update_progress", 0) or 0),

        # Misc
        "account_shard": int(getattr(raw, "account_shard", 0) or 0),
        "nat_flag":      int(getattr(raw, "nat_flag",      0) or 0),
    }
