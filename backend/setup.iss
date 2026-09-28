; Inno Setup script for Starlink Monitor
; Build with: ISCC.exe /DAppVersion=1.0.5 setup.iss

#ifndef AppVersion
  #define AppVersion "0.0.0"
#endif

[Setup]
AppName=Starlink Monitor
AppVersion={#AppVersion}
AppPublisher=Elmeler
AppPublisherURL=https://github.com/Elmeler/Starlink-Dashboard
AppSupportURL=https://github.com/Elmeler/Starlink-Dashboard/issues
DefaultDirName={autopf}\Starlink Monitor
DefaultGroupName=Starlink Monitor
DisableProgramGroupPage=yes
OutputDir=installer_out
OutputBaseFilename=Starlink-Monitor-Setup-v{#AppVersion}
SetupIconFile=icon.ico
Compression=lzma2/ultra64
SolidCompression=yes
WizardStyle=modern
PrivilegesRequired=lowest
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
UninstallDisplayIcon={app}\Starlink Monitor.exe
UninstallDisplayName=Starlink Monitor

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "Create a &desktop shortcut"; GroupDescription: "Additional icons:"
Name: "startupicon"; Description: "Start &automatically with Windows (tray)"; GroupDescription: "Options:"

[Files]
Source: "dist\Starlink Monitor\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{group}\Starlink Monitor";         Filename: "{app}\Starlink Monitor.exe"
Name: "{group}\Uninstall Starlink Monitor"; Filename: "{uninstallexe}"
Name: "{userdesktop}\Starlink Monitor";   Filename: "{app}\Starlink Monitor.exe"; Tasks: desktopicon
Name: "{userstartup}\Starlink Monitor";   Filename: "{app}\Starlink Monitor.exe"; Tasks: startupicon

[Run]
Filename: "{app}\Starlink Monitor.exe"; \
  Description: "Launch Starlink Monitor"; \
  Flags: nowait postinstall skipifsilent

[UninstallDelete]
; Remove config directory created by the app
Type: filesandordirs; Name: "{userappdata}\StarlinkMonitor"
