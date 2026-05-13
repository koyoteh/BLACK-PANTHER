{pkgs}: {
  deps = [
    pkgs.python312Packages.setuptools
    pkgs.ffmpeg
    pkgs.gcc
    pkgs.gnumake
    pkgs.python3
  ];
}
