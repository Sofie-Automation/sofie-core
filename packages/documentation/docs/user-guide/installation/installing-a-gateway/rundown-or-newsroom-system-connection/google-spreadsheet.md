# Google Spreadsheet Gateway

The Spreadsheet Gateway is an application for piping data between Sofie&nbsp;Core and Spreadsheets on Google Drive.

### Example Blueprints for Spreadsheet Gateway

To begin with, you will need to install a set of Blueprints that can handle the data being sent from the _Gateway_ to _Sofie&nbsp;Core_. Download the `demo-blueprints-r*.zip` file containing the blueprints you need from the [Demo Blueprints GitHub Repository](https://github.com/SuperFlyTV/sofie-demo-blueprints/releases). It is recommended to choose the newest release but, an older _Sofie&nbsp;Core_ version may require a different Blueprint version. The _Rundown page_ will warn you about any issue and display the desired versions.

Instructions on how to install any Blueprint can be found in the [Installing Blueprints](../../installing-blueprints.md) section from earlier.

### Spreadsheet Gateway Configuration

If you are using the Docker version of Sofie, then the Spreadsheet Gateway will come preinstalled. For those who are not, please follow the [instructions listed on the GitHub page](https://github.com/SuperFlyTV/spreadsheet-gateway) labeled _Installation \(for developers\)._

Once the Gateway has been installed, you can navigate to the _Settings page_ and check the newly added Gateway is listed as _Spreadsheet Gateway_ under the _Devices section_.

Before you select the Device, you want to add it to the current _Studio_ you are using. Select your current Studio from the menu and navigate to the _Attached Devices_ option. Click the _+_ icon and select the Spreadsheet Gateway.

Now you can select the _Device_ from the _Devices menu_ and click the link provided to enable your Google Drive API to send files to the _Sofie&nbsp;Core_. The page that opens will look similar to the image below.

![Nodejs Quickstart page](/img/docs/installation/installing-a-gateway/rundown-or-newsroom-system-connection/nodejs-quickstart.png)
xx
Make sure to follow the steps in **Create a project and enable the API** and enable the **Google Drive API** as well as the **Google Sheets API**. Your "APIs and services" Dashboard should now look as follows:

![APIs and Services Dashboard](/img/docs/installation/installing-a-gateway/rundown-or-newsroom-system-connection/apis-and-services-dashboard.png)

Now follow the steps in **Create credentials** and make sure to create an **OAuth Client ID** for a **Desktop App** and download the credentials file.

![Create Credentials page](/img/docs/installation/installing-a-gateway/rundown-or-newsroom-system-connection/create-credentials.png)

Use the button to download the configuration to a file and navigate back to _Sofie&nbsp;Core's Settings page_. Select the Spreadsheet Gateway, then click the _Browse_ button and upload the configuration file you just downloaded. A new link will appear to confirm access to your google drive account. Select the link and in the new window, select the Google account you would like to use. Currently, the Sofie&nbsp;Core Application is not verified with Google so you will need to acknowledge this and proceed passed the unverified page. Click the _Advanced_ button and then click _Go to QuickStart \( Unsafe \)_.

After navigating through the prompts you are presented with your verification code. Copy this code into the input field on the _Settings page_ and the field should be removed. A message confirming the access token was saved will appear.

You can now navigate to your Google Drive account and create a new folder for your rundowns. It is important that this folder has a unique name. Next, navigate back to _Sofie&nbsp;Core's Settings page_ and add the folder name to the appropriate input.

The indicator should now read _Good, Watching folder 'Folder Name Here'_. Now you just need an example rundown.[ Navigate to this Google Sheets file](https://docs.google.com/spreadsheets/d/1iyegRv5MxYYtlVu8uEEMkBYXsLL-71PAMrNW0ZfWRUw/edit?usp=sharing) and select the _File_ menu and then select _Make a copy_. In the popup window, select _My Drive_ and then navigate to and select the rundowns folder you created earlier.

At this point, one of two things will happen. If you have the Google Sheets API enabled, this is different from the Google Drive API you enabled earlier, then the Rundown you just copied will appear in the Rundown page and is accessible. The other outcome is the Spreadsheet Gateway status reads _Unknown, Initializing..._ which most likely means you need to enable the Google Sheets API. Navigate to the[ Google Sheets API Dashboard with this link](https://console.developers.google.com/apis/library/sheets.googleapis.com?) and click the _Enable_ button. Navigate back to _Sofie's Settings page_ and restart the Spreadsheet Gateway. The status should now read, _Good, Watching folder 'Folder Name Here'_ and the rundown will appear in the _Rundown page_.

### Further Reading

- [Demo Blueprints](https://github.com/SuperFlyTV/sofie-demo-blueprints/) GitHub Page for Developers
- [Example Rundown](https://docs.google.com/spreadsheets/d/1iyegRv5MxYYtlVu8uEEMkBYXsLL-71PAMrNW0ZfWRUw/edit?usp=sharing) provided by Sofie.
- [Google Sheets API](https://console.developers.google.com/apis/library/sheets.googleapis.com?) on the Google Developer website.
- [Spreadsheet Gateway](https://github.com/SuperFlyTV/spreadsheet-gateway) GitHub Page for Developers
