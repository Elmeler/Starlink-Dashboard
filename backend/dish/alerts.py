"""
Parses the alerts dict returned by starlink_grpc.status_data() into a
list of human-readable active alert strings.
"""

_ALERT_LABELS = {
    "motors_stuck":                    "Motors stuck",
    "thermal_shutdown":                "Thermal shutdown",
    "thermal_throttle":                "Thermal throttling active",
    "unexpected_location":             "Unexpected location",
    "mast_not_near_vertical":          "Mast not near vertical",
    "slow_ethernet_speeds":            "Slow ethernet speeds",
    "roaming":                         "Roaming",
    "install_pending":                 "Install pending",
    "is_heating":                      "Dish is heating",
    "power_supply_thermal_throttle":   "Power supply thermal throttle",
    "is_power_save_idle":              "Power save idle",
    "dbf_telem_stale":                 "DBF telemetry stale",
    "low_motor_current":               "Low motor current",
    "lower_signal_than_predicted":     "Lower signal than predicted",
    "slow_ethernet_speeds_100":        "Slow ethernet (100 Mbps cap)",
    "obstruction_map_reset":           "Obstruction map reset",
    "dish_water_detected":             "Water detected on dish",
    "router_water_detected":           "Water detected on router",
    "upsu_router_port_slow":           "UPSU router port slow",
    "moving_while_not_mobile":         "Moving without mobile plan",
    "moving_too_fast_for_policy":      "Moving too fast for plan",
}


def parse_alerts(alert_dict: dict) -> list[dict]:
    """
    Convert the raw alert_* bool dict from status_data() into a list of
    active alert objects: [{"key": "thermal_throttle", "label": "Thermal throttling active"}]
    """
    active = []
    for raw_key, value in alert_dict.items():
        if not value:
            continue
        # strip "alert_" prefix
        short_key = raw_key.removeprefix("alert_")
        label = _ALERT_LABELS.get(short_key, short_key.replace("_", " ").title())
        active.append({"key": short_key, "label": label})
    return active
