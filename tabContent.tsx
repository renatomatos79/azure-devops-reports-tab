import "./tabContent.scss"

import * as React from "react"
import * as ReactDOM from "react-dom"
import * as SDK from "azure-devops-extension-sdk"

import { getClient } from "azure-devops-extension-api"
import { Build, BuildRestClient, Attachment } from "azure-devops-extension-api/Build"

import { ObservableValue, ObservableObject } from "azure-devops-ui/Core/Observable"
import { Observer } from "azure-devops-ui/Observer"
import { Tab, TabBar, TabSize } from "azure-devops-ui/Tabs"

const ATTACHMENT_TYPE = "report-html";

debugger
SDK.init()
SDK.ready().then(() => {
  try {
    const config = SDK.getConfiguration()
    console.log('debug::configs: ', config)
    config.onBuildChanged((build: Build) => {
      console.log('debug::build: ', build)
      // gets the attachments populated by Tasks/PublishReportX
      let buildAttachmentClient = new BuildAttachmentClient(build)
      buildAttachmentClient.init().then(() => {
        console.log('debug::displayReports: ', buildAttachmentClient)
        displayReports(buildAttachmentClient)
      }).catch(error => {
        console.error('debug::buildAttachmentClient: ', error)
        throw new Error(error)
      })
    })
  } catch(error) {
    console.error('debug::SDK.ready: ', error)
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
    const attachment = this.attachments.find((attachment) => { return attachment.name === attachmentName})
    if (!(attachment && attachment._links && attachment._links.self && attachment._links.self.href)) {
      throw new Error("Attachment " + attachmentName + " is not downloadable")
    }
    return attachment
  }

  public async getAttachmentContent(attachmentName: string): Promise<string> {
    if (this.authHeaders === undefined) {
      console.log('debug::Get access token')
      const accessToken = await SDK.getAccessToken()
      const b64encodedAuth = btoa(':' + accessToken);
      this.authHeaders = { headers: {'Authorization': 'Basic ' + b64encodedAuth} }
    }
    console.log("debug::Get " + attachmentName + " attachment content")
    const attachment = this.getDownloadableAttachment(attachmentName)
    const response = await fetch(attachment._links.self.href, this.authHeaders)
    if (!response.ok) {
      console.error('debug::could not fetch => ', attachment._links.self.href)
      throw new Error(response.statusText)
    }
    const responseText = await response.text()
    console.log('debug::responseText: ', responseText)
    return responseText
  }

}

class BuildAttachmentClient extends AttachmentClient {
  private build: Build

  constructor(build: Build) {
    super()
    this.build = build
  }

  public async init() {
    const buildClient: BuildRestClient = getClient(BuildRestClient)
    this.attachments = await buildClient.getAttachments(this.build.project.id, this.build.id, ATTACHMENT_TYPE)
    console.log(this.attachments)
  }
}


interface TaskAttachmentPanelProps {
  attachmentClient: AttachmentClient
}

export default class TaskAttachmentPanel extends React.Component<TaskAttachmentPanelProps> {
  private selectedTabId: ObservableValue<string>
  private tabContents: ObservableObject<string>
  private tabInitialContent: string = '<div class="wide"><p>Loading report content...</p></div>'

  constructor(props: TaskAttachmentPanelProps) {
    super(props);
    this.selectedTabId = new ObservableValue(props.attachmentClient.getAttachments()[0].name)
    this.tabContents = new ObservableObject()
  }

  public escapeHTML(str: string) {
    return str.replace(/[&<>'"]/g, tag => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[tag] || tag))
  }

  public render() {
    const attachments = this.props.attachmentClient.getAttachments()
    if (attachments.length == 0) {
      return (null)
    } else {
      const tabs = []
      const filteredAttachments = attachments.filter(attachment => attachment.name.endsWith('.html'))
      for (const attachment of filteredAttachments) {
        const metadata = attachment.name.split('~')

        // Determine the tab name and optionally add a badge count
        let name = metadata[0];
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
      }

      return (
        <div className="flex-column">
          { attachments.length > 0 ?
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
                  this.tabContents.set(props.selectedTabId, '<iframe class="wide flex-row flex-center" srcdoc="' + this.escapeHTML(content) + '"></iframe>')
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