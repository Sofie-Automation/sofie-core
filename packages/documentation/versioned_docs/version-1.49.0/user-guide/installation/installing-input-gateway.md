# Input Gateway

The Input Gateway handles control devices that are not capable of running a Web Browser. This allows Sofie to integrate directly with devices such as: Hardware Panels, GPI input, MIDI devices and external systems being able to send an HTTP Request.

To install it, begin by downloading the latest release of [Input Gateway from GitHub](https://github.com/nrkno/sofie-input-gateway/releases). You can now run the `input-gateway.exe` file inside the extracted folder. A warning window may popup about the app being unrecognized. You can get around this by selecting _More Info_ and clicking _Run Anyways_.

Much like [Package Manager](./installing-package-manager), the Sofie instance that Input Gateway needs to connect to is configured through command line arguments. A minimal configuration could look something like this.

```bash
input-gateway.exe --host <Core Host Name> --port <Core HTTP(S) port> --https --id <Peripheral Device Id> --token <Peripheral Device Token/Password>
```

If not connecting over HTTPS, remove the `--https` flag.

Input Gateway can be launched from [CasparCG Launcher](./installing-connections-and-additional-hardware/casparcg-server-installation#installing-the-casparcg-launcher). This will make management and log collection easier on a production system.

You can now open the _Sofie&nbsp;Core_, `http://localhost:3000`, and navigate to the _Settings page_. You will see your _Input Gateway_ under the _Devices_ section of the menu. In _Input Devices_ you can add devices that this instance of Input Gateway should handle. Some of the device integrations will allow you to customize the Feedback behavior. The _Device ID_ property will identify a given Input Device in the Studio, so this property can be used for fail-over purposes.

## Supported devices and protocols

Currently, input gateway supports:

- Stream Deck panels
- Skaarhoj panels - _TCP Raw Panel_ mode
- X-Keys panels
- MIDI controllers
- OSC
- HTTP

### Further Reading

- [Input Gateway Releases on GitHub](https://github.com/nrkno/sofie-input-gateway/releases)
- [Input Gateway GitHub Page for Developers](https://github.com/nrkno/sofie-input-gateway)
