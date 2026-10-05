# Adding FFmpeg and FFprobe to your PATH on Windows

Some parts of Sofie (specifically the Package Manager) require that [`FFmpeg`](https://www.ffmpeg.org/) and [`FFprobe`](https://ffmpeg.org/ffprobe.html) be available in your `PATH` environment variable. This guide will go over how to download these executables and add them to your `PATH`.

### Installation

1. `FFmpeg` and `FFprobe` can be downloaded from the [FFmpeg Downloads page](https://ffmpeg.org/download.html) under the "Get packages & executable files" heading. At the time of writing, there are two sources of Windows builds: `gyan.dev` and `BtbN` -- either one will work.
2. Once downloaded, extract the archive to some place permanent such as `C:\Program Files\FFmpeg`.
   - You should end up with a `bin` folder inside of `C:\Program Files\FFmpeg` and in that `bin` folder should be three executables: `ffmpeg.exe`, `ffprobe.exe`, and `ffplay.exe`.
3. Open your Start Menu and type `path`. An option named "Edit the system environment variables" should come up. Click on that option to open the System Properties menu.

   ![Start Menu screenshot](/img/docs/edit_system_environment_variables.jpg)

4. In the System Properties menu, click the "Environment Variables..." button at the bottom of the "Advanced" tab.

   ![System Properties screenshot](/img/docs/system_properties.png)

5. If you installed `FFmpeg` and `FFprobe` to a system-wide location such as `C:\Program Files\FFmpeg`, select and edit the `Path` variable under the "System variables" heading. Else, if you installed them to some place specific to your user account, edit the `Path` variable under the "User variables for \<YOUR ACCOUNT NAME>" heading.

   ![Environment Variables screenshot](/img/docs/environment_variables.png)

6. In the window that pops up when you click "Edit...", click "New" and enter the path to the `bin` folder you extracted earlier. Then, click OK to add it.

   ![Edit environment variable screenshot](/img/docs/edit_path_environment_variable.png)

7. Click "OK" to close the Environment Variables window, and then click "OK" again to close the
   System Properties window.
8. Verify that it worked by opening a Command Prompt and executing the following commands:

   ```cmd
   ffmpeg -version
   ffprobe -version
   ```

   If you see version output from both of those commands, then you are all set! If not, double check the paths you entered and try restarting your computer.
