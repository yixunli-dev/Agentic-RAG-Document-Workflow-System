import React, { useMemo, useState } from "react";
import {
  Badge,
  Button,
  Card,
  Col,
  Collapse,
  Divider,
  Form,
  Input,
  InputNumber,
  Layout,
  Menu,
  Progress,
  Row,
  Segmented,
  Select,
  Slider,
  Space,
  Statistic,
  Switch,
  Table,
  Tabs,
  Tag,
  Timeline,
  Typography,
  Upload,
} from "antd";
import "./App.css";
import {
  citations as defaultCitations,
  evaluationCases,
  examplePrompts,
  guardrails as defaultGuardrails,
  initialDocuments,
  retrievedChunks,
  workflowSteps,
} from "./mockData";
import { createMockDocument, runMockAgent } from "./mockApi";

const { Content, Sider } = Layout;
const { Dragger } = Upload;
const { Paragraph, Text, Title } = Typography;

const statusColor = {
  Pending: "default",
  Running: "processing",
  Completed: "success",
  "Needs Review": "warning",
  Failed: "error",
  Passed: "success",
  Warning: "warning",
  pending: "default",
  running: "processing",
  completed: "success",
  warning: "warning",
  failed: "error",
};

const getStepStatus = (index, activeIndex, runStatus) => {
  if (runStatus === "Idle") return "pending";
  if (index < activeIndex) return index === 5 || index === 6 ? "warning" : "completed";
  if (index === activeIndex && runStatus === "Running") return "running";
  if (runStatus === "Needs Review" || runStatus === "Completed") return index === 5 || index === 6 ? "warning" : "completed";
  return "pending";
};

function DocumentUploadPanel({ documents, setDocuments }) {
  const uploadProps = {
    accept: ".pdf,application/pdf",
    multiple: true,
    showUploadList: false,
    beforeUpload: (file, fileList) => {
      if (fileList[0]?.uid === file.uid) {
        setDocuments((current) => [...current, ...fileList.map(createMockDocument)]);
      }
      return false;
    },
  };

  return (
    <Card title="Document Intake" className="panel-card">
      <Dragger {...uploadProps}>
        <p className="upload-glyph">PDF</p>
        <p className="ant-upload-text">Drag and drop PDF files into the document workspace</p>
        <p className="ant-upload-hint">Mock ingestion creates chunk and embedding metadata only.</p>
      </Dragger>
      <div className="document-list">
        {documents.map((document) => (
          <div className="document-row" key={document.id}>
            <div>
              <Text strong>{document.name}</Text>
              <div className="muted">{document.size}</div>
            </div>
            <Space wrap>
              <Tag color="blue">{document.status}</Tag>
              <Tag color="geekblue">{document.chunks} chunks</Tag>
              <Tag color="green">{document.embeddingStatus}</Tag>
            </Space>
          </div>
        ))}
      </div>
    </Card>
  );
}

function QueryPanel({ query, setQuery, isRunning, onRun }) {
  return (
    <Card title="Ask the Document Agent" className="panel-card">
      <Space direction="vertical" size="middle" className="full-width">
        <Input.TextArea
          rows={4}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Compare the refund policy across the uploaded documents and identify risky clauses."
        />
        <Space wrap>
          {examplePrompts.map((prompt) => (
            <Button key={prompt} onClick={() => setQuery(prompt)}>
              {prompt}
            </Button>
          ))}
        </Space>
        <Button type="primary" size="large" loading={isRunning} onClick={onRun}>
          Run Agent Workflow
        </Button>
      </Space>
    </Card>
  );
}

function AnswerCard({ result, selectedCitation, setSelectedCitation }) {
  if (!result) {
    return (
      <Card className="answer-card empty-state">
        <Title level={4}>No run yet</Title>
        <Paragraph>Upload documents and run a question to see grounded answers, citations, and review signals.</Paragraph>
      </Card>
    );
  }

  const answerParts = result.answer.split(/(\[\d+\])/g);

  return (
    <Card className="answer-card" title="Final Answer">
      <Paragraph className="answer-text">
        {answerParts.map((part, index) => {
          const match = part.match(/\[(\d+)\]/);
          if (!match) return <React.Fragment key={`${part}-${index}`}>{part}</React.Fragment>;
          const citationId = Number(match[1]);
          return (
            <button
              className={`citation-marker ${selectedCitation === citationId ? "active" : ""}`}
              key={part}
              onClick={() => setSelectedCitation(citationId)}
            >
              {part}
            </button>
          );
        })}
      </Paragraph>
      <Row gutter={[12, 12]}>
        <Col xs={12} md={6}>
          <Statistic title="Latency" value={result.metrics.latency} />
        </Col>
        <Col xs={12} md={6}>
          <Statistic title="Token Usage" value={result.metrics.tokenUsage} />
        </Col>
        <Col xs={12} md={6}>
          <Statistic title="Cost Estimate" value={result.metrics.cost} />
        </Col>
        <Col xs={12} md={6}>
          <Statistic title="Citation Accuracy" value={result.metrics.citationAccuracy} />
        </Col>
      </Row>
    </Card>
  );
}

function WorkflowTrace({ activeStep, runStatus }) {
  return (
    <Card
      title="Agent Workflow Trace"
      extra={<Badge status={statusColor[runStatus] || "default"} text={runStatus} />}
      className="panel-card trace-card"
    >
      <Timeline
        items={workflowSteps.map((step, index) => ({
          color: getStepStatus(index, activeStep, runStatus) === "warning" ? "orange" : undefined,
          children: (
            <Collapse
              ghost
              items={[
                {
                  key: step.key,
                  label: (
                    <div className="trace-label">
                      <Text strong>{step.title}</Text>
                      <Tag color={statusColor[getStepStatus(index, activeStep, runStatus)]}>
                        {getStepStatus(index, activeStep, runStatus)}
                      </Tag>
                    </div>
                  ),
                  children: (
                    <Space direction="vertical" size={4}>
                      <Text>{step.description}</Text>
                      <Text type="secondary">Latency: {step.latency} ms</Text>
                      <Text type="secondary">Component: {step.component}</Text>
                      <Text>{step.details}</Text>
                    </Space>
                  ),
                },
              ]}
            />
          ),
        }))}
      />
    </Card>
  );
}

function CitationPanel({ citations, selectedCitation }) {
  return (
    <Row gutter={[16, 16]}>
      {citations.map((citation) => (
        <Col xs={24} lg={8} key={citation.id}>
          <Card className={`citation-card ${selectedCitation === citation.id ? "selected" : ""}`}>
            <Tag color="blue">[{citation.id}]</Tag>
            <Text strong>
              {citation.document}, page {citation.page}
            </Text>
            <Paragraph>"{citation.text}"</Paragraph>
            <Progress percent={Math.round(citation.score * 100)} size="small" />
          </Card>
        </Col>
      ))}
    </Row>
  );
}

function ChunksPanel({ chunks }) {
  const columns = [
    { title: "Rank", dataIndex: "rank", width: 80 },
    { title: "Document", dataIndex: "document" },
    { title: "Page", dataIndex: "page", width: 80 },
    {
      title: "Relevance Score",
      dataIndex: "score",
      render: (score) => (
        <Space>
          <Text>{score.toFixed(2)}</Text>
          <Tag color={score > 0.9 ? "green" : score > 0.84 ? "gold" : "default"}>
            {score > 0.9 ? "High relevance" : score > 0.84 ? "Medium relevance" : "Low relevance"}
          </Tag>
        </Space>
      ),
    },
    { title: "Chunk Preview", dataIndex: "preview" },
  ];

  return <Table columns={columns} dataSource={chunks} pagination={false} size="middle" />;
}

function GuardrailsPanel({ checks, setRunStatus }) {
  const hasWarning = checks.some((check) => check.status === "Warning" || check.status === "Failed");

  return (
    <Space direction="vertical" size="middle" className="full-width">
      {hasWarning && (
        <Card className="review-card">
          <Tag color="orange">Needs Human Review</Tag>
          <Title level={5}>Warning summary</Title>
          <Paragraph>Unsupported claim and context sufficiency checks need review before the answer is finalized.</Paragraph>
          <Space wrap>
            <Button type="primary" onClick={() => setRunStatus("Completed")}>
              Approve Answer
            </Button>
            <Button onClick={() => setRunStatus("Running")}>Regenerate Answer</Button>
            <Button onClick={() => setRunStatus("Needs Review")}>Edit Before Sending</Button>
          </Space>
        </Card>
      )}
      <Row gutter={[16, 16]}>
        {checks.map((check) => (
          <Col xs={24} lg={12} key={check.key}>
            <Card>
              <Space direction="vertical">
                <Tag color={statusColor[check.status]}>{check.status}</Tag>
                <Text strong>{check.check}</Text>
                <Text>{check.explanation}</Text>
              </Space>
            </Card>
          </Col>
        ))}
      </Row>
    </Space>
  );
}

function Workspace() {
  const [documents, setDocuments] = useState(initialDocuments);
  const [query, setQuery] = useState("");
  const [result, setResult] = useState(null);
  const [runStatus, setRunStatus] = useState("Idle");
  const [activeStep, setActiveStep] = useState(-1);
  const [selectedCitation, setSelectedCitation] = useState(1);
  const [settings] = useState({
    model: "GPT-4.1",
    topK: 5,
    guardrailsEnabled: true,
    humanReviewEnabled: true,
    traceLoggingEnabled: true,
    temperature: 0.2,
  });

  const checks = result?.guardrails || defaultGuardrails;
  const citations = result?.citations || defaultCitations;
  const chunks = result?.chunks || retrievedChunks;
  const isRunning = runStatus === "Running";

  const handleRun = async () => {
    setRunStatus("Running");
    setActiveStep(0);
    const nextResult = await runMockAgent(query, settings, setActiveStep);
    setResult(nextResult);
    setRunStatus(nextResult.guardrails.some((check) => check.status === "Warning" || check.status === "Failed") ? "Needs Review" : "Completed");
    setActiveStep(workflowSteps.length);
  };

  return (
    <div className="workspace-grid">
      <div className="workspace-main">
        <DocumentUploadPanel documents={documents} setDocuments={setDocuments} />
        <QueryPanel query={query} setQuery={setQuery} isRunning={isRunning} onRun={handleRun} />
        <AnswerCard result={result} selectedCitation={selectedCitation} setSelectedCitation={setSelectedCitation} />
        <Card className="panel-card">
          <div className="guardrail-strip">
            <Tag color={runStatus === "Needs Review" ? "orange" : "green"}>
              {runStatus === "Needs Review" ? "Needs Human Review" : "Citation coverage"}
            </Tag>
            <Text type="secondary">
              {runStatus === "Needs Review"
                ? "Warnings are present. Review the answer before final approval."
                : "Every final response is checked for source coverage, unsupported claims, and context sufficiency."}
            </Text>
            {runStatus === "Needs Review" && (
              <Space wrap>
                <Button type="primary" onClick={() => setRunStatus("Completed")}>
                  Approve Answer
                </Button>
                <Button onClick={handleRun}>Regenerate Answer</Button>
                <Button>Edit Before Sending</Button>
              </Space>
            )}
          </div>
          <Tabs
            items={[
              {
                key: "citations",
                label: "Citations",
                children: <CitationPanel citations={citations} selectedCitation={selectedCitation} />,
              },
              { key: "chunks", label: "Retrieved Chunks", children: <ChunksPanel chunks={chunks} /> },
              { key: "guardrails", label: "Guardrails", children: <GuardrailsPanel checks={checks} setRunStatus={setRunStatus} /> },
            ]}
          />
        </Card>
      </div>
      <WorkflowTrace activeStep={activeStep} runStatus={runStatus} />
    </div>
  );
}

function DocumentsPage() {
  return (
    <Card title="Documents" className="panel-card">
      <Table
        dataSource={initialDocuments}
        pagination={false}
        columns={[
          { title: "File name", dataIndex: "name" },
          { title: "File size", dataIndex: "size" },
          { title: "Upload status", dataIndex: "status", render: (value) => <Tag color="blue">{value}</Tag> },
          { title: "Fake chunk count", dataIndex: "chunks" },
          { title: "Embedding status", dataIndex: "embeddingStatus", render: (value) => <Tag color="green">{value}</Tag> },
        ]}
      />
    </Card>
  );
}

function EvaluationPage() {
  const columns = [
    { title: "Case ID", dataIndex: "caseId" },
    { title: "Query Type", dataIndex: "queryType" },
    { title: "Expected Source", dataIndex: "expectedSource" },
    { title: "Retrieval Passed", dataIndex: "retrievalPassed", render: (value) => <Tag color={value ? "green" : "red"}>{value ? "Yes" : "No"}</Tag> },
    { title: "Faithfulness Score", dataIndex: "faithfulness", render: (value) => `${value}%` },
    { title: "Citation Accuracy", dataIndex: "citationAccuracy", render: (value) => `${value}%` },
    { title: "Status", dataIndex: "status", render: (value) => <Tag color={value === "Passed" ? "green" : value === "Review" ? "orange" : "red"}>{value}</Tag> },
  ];

  return (
    <Space direction="vertical" size="large" className="full-width">
      <Title level={2}>Evaluation Dashboard</Title>
      <Row gutter={[16, 16]}>
        {[
          ["Retrieval Recall@5", 91],
          ["Answer Faithfulness", 88],
          ["Citation Accuracy", 92],
          ["Guardrail Pass Rate", 84],
        ].map(([label, value]) => (
          <Col xs={24} md={12} xl={6} key={label}>
            <Card>
              <Statistic title={label} value={value} suffix="%" />
              <Progress percent={value} />
            </Card>
          </Col>
        ))}
        <Col xs={24} md={12}>
          <Card>
            <Statistic title="Average Latency" value="2.8s" />
          </Card>
        </Col>
        <Col xs={24} md={12}>
          <Card>
            <Statistic title="Average Cost per Query" value="$0.018" />
          </Card>
        </Col>
      </Row>
      <Card title="Evaluation Cases">
        <Table columns={columns} dataSource={evaluationCases} pagination={false} />
      </Card>
    </Space>
  );
}

function SettingsPage() {
  return (
    <Space direction="vertical" size="large" className="full-width">
      <Title level={2}>Settings</Title>
      <Card title="Runtime Settings" className="settings-card">
        <Form layout="vertical" initialValues={{ model: "GPT-4.1", topK: 5, temperature: 0.2 }}>
          <Form.Item label="Model selector" name="model">
            <Select
              options={[
                { value: "GPT-4.1", label: "GPT-4.1" },
                { value: "GPT-4o", label: "GPT-4o" },
                { value: "GPT-4o mini", label: "GPT-4o mini" },
              ]}
            />
          </Form.Item>
          <Form.Item label="Retrieval top-k" name="topK">
            <InputNumber min={1} max={20} />
          </Form.Item>
          <Form.Item label="Temperature" name="temperature">
            <Slider min={0} max={1} step={0.1} />
          </Form.Item>
          <Divider />
          <Space direction="vertical">
            <Text>Enable guardrails <Switch defaultChecked /></Text>
            <Text>Enable human review <Switch defaultChecked /></Text>
            <Text>Enable trace logging <Switch defaultChecked /></Text>
          </Space>
        </Form>
      </Card>
    </Space>
  );
}

function TraceViewerPage() {
  return (
    <Space direction="vertical" size="large" className="full-width">
      <Title level={2}>Trace Viewer</Title>
      <WorkflowTrace activeStep={workflowSteps.length} runStatus="Needs Review" />
    </Space>
  );
}

function App() {
  const [page, setPage] = useState("workspace");
  const content = useMemo(
    () => ({
      workspace: <Workspace />,
      documents: <DocumentsPage />,
      trace: <TraceViewerPage />,
      evaluation: <EvaluationPage />,
      settings: <SettingsPage />,
    }),
    []
  );

  return (
    <Layout className="app-shell">
      <Sider width={248} className="sidebar">
        <Title level={3} className="brand">
          Agentic RAG
        </Title>
        <Menu
          mode="inline"
          selectedKeys={[page]}
          onClick={({ key }) => setPage(key)}
          items={[
            { key: "workspace", label: "Workspace" },
            { key: "documents", label: "Documents" },
            { key: "trace", label: "Trace Viewer" },
            { key: "evaluation", label: "Evaluation" },
            { key: "settings", label: "Settings" },
          ]}
        />
        <div className="sidebar-footer">
          <Text type="secondary">Mock API Mode</Text>
          <Segmented options={["Dev", "Demo"]} defaultValue="Demo" />
        </div>
      </Sider>
      <Layout>
        <Content className="content-shell">{content[page]}</Content>
      </Layout>
    </Layout>
  );
}

export default App;
