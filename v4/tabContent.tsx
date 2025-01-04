import * as React from "react"
import * as ReactDOM from "react-dom"
import * as SDK from "azure-devops-extension-sdk"

import { getClient } from "azure-devops-extension-api"
import { Build, BuildRestClient, Attachment } from "azure-devops-extension-api/Build"
import { ObservableValue, ObservableObject } from "azure-devops-ui/Core/Observable"
import { Observer } from "azure-devops-ui/Observer"
import { Tab, TabBar, TabSize } from "azure-devops-ui/Tabs"

const ATTACHMENT_TYPE = "report-html";

SDK.init()
SDK.ready().then(() => {
  try {
    const config = SDK.getConfiguration()
    console.log('debug::config. ', config)
    config.onBuildChanged((build: Build) => {
      console.log('debug::build: ', build)
      let buildAttachmentClient = new BuildAttachmentClient(build)
      buildAttachmentClient.init().then(() => {
        console.log('debug::displayReports: ', buildAttachmentClient)
        displayReports(buildAttachmentClient)
      }).catch(error => {
        console.log('debug::buildAttachmentClient ERROR: ', error)
        throw new Error(error)
      })
    })
  } catch(error) {
    console.log('debug::SKD ERROR: ', error)
    throw new Error(error)
  }
})

function displayReports(attachmentClient: AttachmentClient) {
  ReactDOM.render(<TaskAttachmentPanel attachmentClient={attachmentClient} />, document.getElementById("dev-root"))
}

abstract class AttachmentClient {
  protected attachments: Attachment[] = []
  protected authHeaders: Object = undefined
  protected reportHtmlContent: string = undefined
  constructor() {}

  public getAttachments() : Attachment[] {
    return this.attachments
  }

  public getDownloadableAttachment(attachmentName: string): Attachment {
    try {
      const attachment = this.attachments.find((attachment) => { return attachment.name === attachmentName})
      if (!(attachment && attachment._links && attachment._links.self && attachment._links.self.href)) {
        console.log('debug::getDownloadableAttachment ERROR: ', attachmentName)
        throw new Error("Attachment " + attachmentName + " is not downloadable")
      }
      return attachment
    } catch (error) {
      console.log('debug::getDownloadableAttachment ERROR: ', error)
      throw new Error(error)
    }
  }

  public async getAttachmentContent(attachmentName: string): Promise<string> {
    try {
      if (this.authHeaders === undefined) {
        console.log('debug::Get access token')
        const accessToken = await SDK.getAccessToken()
        console.log('debug::SDK:Access token: ', accessToken)
        const b64encodedAuth = btoa(':' + accessToken);
        this.authHeaders = { headers: {'Authorization': 'Basic ' + b64encodedAuth} }
      }
      console.log("debug::Get " + attachmentName + " attachment content")
      const attachment = this.getDownloadableAttachment(attachmentName)
      const response = await fetch(attachment._links.self.href, this.authHeaders)
      if (!response.ok) {
        console.log("debug::fetch  ", attachment._links.self.href, " ERROR: ", response.statusText)
        throw new Error(response.statusText)
      }
      const responseText = await response.text()
      console.log('debug::responseText: ', responseText)
      return responseText
    } catch (error) {
      console.log('debug::getAttachmentContent ERROR: ', error)
      throw new Error(error)
    }
  }
}

class BuildAttachmentClient extends AttachmentClient {
  private build: Build

  constructor(build: Build) {
    try {
      super()
      this.build = build
    } catch (error) {
      console.log('debug::BuildAttachmentClient:CTO ERROR: ', error)
      throw new Error
    }
  }

  public async init() {
    try {
      const buildClient: BuildRestClient = getClient(BuildRestClient)
      this.attachments = await buildClient.getAttachments(this.build.project.id, this.build.id, ATTACHMENT_TYPE)
      console.log('debug::init attachments: ', this.attachments)
    } catch (error) {
      console.log('debug::init ERROR: ', error)
      throw new Error
    }
  }
}

interface TaskAttachmentPanelProps {
  attachmentClient: AttachmentClient
}

export default class TaskAttachmentPanel extends React.Component<TaskAttachmentPanelProps> {
  private selectedTabId: ObservableValue<string>
  private tabContents: ObservableObject<string>
  private tabInitialContent: string = '<div class="wide"><p>Loading...</p></div>'

  constructor(props: TaskAttachmentPanelProps) {
    super(props);
    const atts = props.attachmentClient.getAttachments()
    this.selectedTabId = new ObservableValue(atts.length > 0 ? atts[0].name :  '')
    this.tabContents = new ObservableObject()
  }

  public render() {
    const atts = this.props.attachmentClient.getAttachments()
    if (atts.length == 0) {
      return (null)
    } else {
      const tabs = []
      // Filter out attachments that are not html files
      // const filteredAttachments = atts.filter(attachment => attachment.name.endsWith('html'))
      console.log('debug::filteredAttachments: ', atts)  
      for (const attachment of atts) {
        try {
          // for more details, check generateName in Tasks/PublishReport/index.ts
          // ${tabName}.${jobName}.${stageName}.${stageAttempt}.${fileName}`
          const metadata = attachment.name.split('.')
          console.log('debug::render:metadata: ', metadata)

          // Determine the tab name and optionally add a badge count
          let name = `${metadata[4]}.html`;
          let badgeCount = undefined; // Default badgeCount is undefined which means no badge is shown

          if (metadata[2] !== '__default') {
            // Only add badgeCount for secondary attempts
            if (parseInt(metadata[3]) > 1) {
              badgeCount = parseInt(metadata[3]);
            }
          }

          tabs.push(<Tab
            name={name}
            id={attachment.name}
            key={attachment.name}
            url={attachment._links.self.href}
            badgeCount={badgeCount} // This will only be added if badgeCount is not undefined
          />)

          this.tabContents.add(attachment.name, this.tabInitialContent)
        } catch (error) {
          console.log('debug::render ERROR: ', error, " attachment: ", attachment)
          throw new Error(error)
        }
      }

      return (
        <div className="flex-column">
          { atts.length > 0 ?
            <TabBar
              onSelectedTabChanged={this.onSelectedTabChanged}
              selectedTabId={this.selectedTabId}
              tabSize={TabSize.Tall}
              >
              {tabs}
            </TabBar>
          : null }
          <Observer selectedTabId={this.selectedTabId} tabContents={this.tabContents}>
            {(props: { selectedTabId: string }) => {
              if ( this.tabContents.get(props.selectedTabId) === this.tabInitialContent) {
                this.props.attachmentClient.getAttachmentContent(props.selectedTabId).then((content) => {
                  console.log('debug::content: ', content)
                  this.tabContents.set(props.selectedTabId, '<iframe class="wide flex-row flex-center" srcdoc="' + content + '"></iframe>')
              })
            }
              return <span dangerouslySetInnerHTML={ {__html: this.tabContents.get(props.selectedTabId)} } />
            }}
          </Observer>
        </div>
      );
    }
  }

  private onSelectedTabChanged = (newTabId: string) => {
    this.selectedTabId.value = newTabId;
  }
}