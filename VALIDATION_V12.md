# CyberLab v12 validation

## Fixed from v11
- Core UI no longer waits for Neon/esm.sh before rendering.
- Suggested terminal commands execute on click; explicit Run button added.
- Terminal requires a selected device.
- Lab 2 requires the learner to actually execute `ipconfig` on the PC.
- Inspector port rows are interactive and record exact port inspection.
- Guided labs hide Add Device controls; sandbox retains them.
- Cabling exposes a persistent state tray: cable selected -> first end -> second end -> complete/cancel.
- Exact requested ports are visually highlighted for connection steps.
- Failed Guided checks explain the missing action and re-highlight the target.
- Subnet comparison uses configured masks instead of assuming /24.
- Practice checks are stricter for Labs 1-3.

## Automated engine regression
PASS RJ45 rejects console port
PASS RJ45 connects PC Eth0 to switch Gi0/1
PASS occupied port cannot be reused
PASS server Ethernet link
PASS /22 subnet recognition
PASS /24 separation recognition
PASS ping respects subnet mask
PASS ping rejects destination outside configured subnet
PASS ipconfig outputs actual configuration
PASS unavailable command returns educational feedback

## Static interaction checks
PASS all JavaScript files pass `node --check`
PASS explicit Run command control exists
PASS persistent DO THIS NOW guidance exists
PASS cabling second-end guidance exists
PASS Lab 2 checks actual ipconfig command evidence

## Browser environment note
The container Chromium process hangs in its DBus/headless runtime, so a successful automated visual Chromium pass is not claimed. The runtime source and deterministic engine/interaction checks above passed.
