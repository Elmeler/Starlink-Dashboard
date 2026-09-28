/**
 * Per-alert descriptions, explanations, and suggested actions.
 *
 * keys match the short key used in the alerts array
 * (i.e. "install_pending", not "alert_install_pending").
 */
export const ALERT_META = {
  install_pending: {
    description:
      'The dish has not yet completed its initial installation sequence. ' +
      'It needs unobstructed sky view to finish calibrating the obstruction ' +
      'map and confirm its service location.',
    actions: [
      'Open the Starlink app → tap the dish icon → follow the setup wizard',
      'Ensure the dish has a clear view of the sky — no trees, eaves, or structures nearby',
      'Allow 20–60 min after first power-on; the alert clears automatically when done',
      'If the dish has been running for hours with no change, try a reboot',
    ],
    canReboot: true,
  },

  motors_stuck: {
    description:
      'The dish motors cannot move the dish to its target pointing position. ' +
      'This prevents the dish from tracking satellites properly.',
    actions: [
      'Check the dish mount for ice, debris, or anything physically blocking movement',
      'If safe, manually clear any obstruction and reboot the dish',
      'Persistent motor errors may require a hardware replacement — contact Starlink support',
    ],
    canReboot: true,
  },

  thermal_shutdown: {
    description:
      'The dish exceeded its maximum safe temperature and shut itself down to prevent damage. ' +
      'Connectivity is interrupted until it cools.',
    actions: [
      'Wait 10–20 min for the dish to cool before it automatically recovers',
      'Ensure the mounting location has adequate airflow — avoid enclosed spaces or direct sun traps',
      'If this recurs, consider a shade structure or relocating the mount',
    ],
    canReboot: false,
  },

  thermal_throttle: {
    description:
      'The dish is reducing its performance to stay within safe temperature limits. ' +
      'Speeds may be noticeably lower than usual.',
    actions: [
      'Ensure the dish has good airflow — it radiates heat through the back surface',
      'Avoid mounting it flush against a wall or roof in direct sun',
      'This is more common in summer; performance recovers as the dish cools',
    ],
    canReboot: false,
  },

  unexpected_location: {
    description:
      'The dish detected it is operating in a location that does not match its registered service address.',
    actions: [
      'If you have moved, update your service address in the Starlink app (Account → Service Address)',
      'If you are on a Roam or Portability plan this may not apply — check your plan in the app',
      'Persistent alerts may restrict connectivity until the address is updated',
    ],
    canReboot: false,
  },

  mast_not_near_vertical: {
    description:
      'The dish tilt sensor reports the mount is more than ~7° from vertical. ' +
      'Performance and sky coverage are reduced when the dish is tilted beyond this limit.',
    actions: [
      'Use a spirit level and adjust the pole or mounting bracket until the mast is within 7° of vertical',
      'Motorised dishes (Standard, Gen 3) can electronically compensate small tilts but still lose coverage area beyond 7°',
      'Electronically steered dishes (HP Gen 1, Flat HP) cannot compensate for tilt — the beam will miss part of the sky',
      'On a vehicle or boat, check the mounting base for flex or movement that could cause the reading',
    ],
    canReboot: false,
  },

  slow_ethernet_speeds: {
    description:
      'The ethernet link between the dish and router is running below its rated speed, ' +
      'limiting your maximum throughput.',
    actions: [
      'Replace the cable with a quality Cat 5e or Cat 6 cable rated for outdoor use',
      'Inspect the cable ends and connectors for corrosion or damage',
      'Check that both ends are firmly seated in their ports',
    ],
    canReboot: false,
  },

  slow_ethernet_speeds_100: {
    description:
      'The ethernet connection has negotiated at 100 Mbps instead of Gigabit, ' +
      'capping your speeds regardless of the satellite link quality.',
    actions: [
      'Replace the cable with a Cat 5e or Cat 6 cable — Cat 5 or damaged cables often negotiate at 100 Mbps',
      'Check that any switches or adapters in the path also support Gigabit',
    ],
    canReboot: false,
  },

  roaming: {
    description:
      'The dish is connected via roaming coverage rather than your home region. ' +
      'This is normal on Roam or Portability plans; on residential plans it may indicate a service issue.',
    actions: [
      'No action needed if you are travelling on a Roam or Portability plan',
      'If you are at your home address, check your plan details in the Starlink app',
    ],
    canReboot: false,
  },

  is_heating: {
    description:
      'The dish is actively running its built-in heater to melt snow or ice. ' +
      'This is normal in cold or snowy conditions and consumes extra power temporarily.',
    actions: [
      'No action needed — this is expected cold-weather behaviour',
      'Power draw will be higher than usual while heating is active',
    ],
    canReboot: false,
  },

  power_supply_thermal_throttle: {
    description:
      'The power supply unit is running hot and has reduced output to protect itself.',
    actions: [
      'Ensure the router/power unit has adequate ventilation and is not in an enclosed space',
      'Check the area around the power brick for accumulated dust or heat sources',
    ],
    canReboot: false,
  },

  is_power_save_idle: {
    description:
      'The dish is in a scheduled power-save window and has reduced its activity.',
    actions: [
      'This is expected if you have configured a sleep schedule in Settings → Sleep Mode',
      'To disable, open the Starlink app → Settings → Sleep Schedule → turn off',
    ],
    canReboot: false,
  },

  low_motor_current: {
    description:
      'The dish motor is drawing unexpectedly low current, which may indicate a motor fault ' +
      'or that the dish is stuck.',
    actions: [
      'Reboot the dish and see if the alert clears',
      'If it persists, contact Starlink support — this may indicate a hardware issue',
    ],
    canReboot: true,
  },

  dbf_telem_stale: {
    description:
      'Internal digital beamforming telemetry has gone stale. ' +
      'This is usually a transient firmware issue.',
    actions: [
      'Reboot the dish — this alert typically clears after a restart',
      'If it persists after several reboots, contact Starlink support',
    ],
    canReboot: true,
  },

  lower_signal_than_predicted: {
    description:
      'The received signal is weaker than the dish\'s model predicts for its current pointing direction. ' +
      'This can indicate a partial obstruction or hardware degradation.',
    actions: [
      'Check the Obstruction Map in Diagnostics for newly blocked sky areas',
      'Inspect the dish surface for damage, heavy soiling, or ice',
      'If the obstruction map looks clear, the issue may be hardware — contact support',
    ],
    canReboot: false,
  },

  obstruction_map_reset: {
    description:
      'The dish cleared its obstruction map and is rebuilding it from scratch. ' +
      'Performance may vary while the map is incomplete.',
    actions: [
      'No action needed — the map rebuilds automatically over 12–24 hours of operation',
      'Avoid manually resetting the obstruction map repeatedly, as it degrades short-term performance',
    ],
    canReboot: false,
  },

  dish_water_detected: {
    description:
      'Moisture has been detected inside the dish unit.',
    actions: [
      'Inspect the dish cable entry and connector for damage or missing weatherproofing',
      'Ensure the dish drain holes (if any) are clear',
      'Contact Starlink support if the alert persists — internal moisture can cause hardware failure',
    ],
    canReboot: false,
  },

  router_water_detected: {
    description:
      'Moisture has been detected inside the Starlink router.',
    actions: [
      'Move the router to a dry, indoor location if it is currently exposed',
      'Inspect all cable connections and housing for damage',
      'Contact Starlink support — internal moisture can cause hardware failure',
    ],
    canReboot: false,
  },

  upsu_router_port_slow: {
    description:
      'The UPSU (unified power supply unit) router port is running at reduced speed.',
    actions: [
      'Check the cable between the UPSU and router for damage',
      'Try a different cable or port if available',
    ],
    canReboot: false,
  },

  moving_while_not_mobile: {
    description:
      'The dish has detected movement but your plan does not include the Mobile or Roam add-on. ' +
      'Service may be suspended until the dish returns to its registered address.',
    actions: [
      'If you intended to move, add the Roam add-on in the Starlink app before relocating',
      'If the dish has not moved, check its mounting — vibration or a tilting mount can trigger this',
      'Return the dish to its registered service address to restore service',
    ],
    canReboot: false,
  },

  moving_too_fast_for_policy: {
    description:
      'The dish is moving faster than your plan permits. ' +
      'Standard Roam service is for stationary or slow-moving use; in-motion service requires the Mobile Priority plan.',
    actions: [
      'Slow down or stop the vehicle to restore service on a Roam plan',
      'Upgrade to Mobile Priority if you need connectivity while in motion',
    ],
    canReboot: false,
  },
}
