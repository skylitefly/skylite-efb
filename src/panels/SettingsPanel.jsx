import {Button, Form, Input, Space, Typography} from 'antd';

const {Text} = Typography;

export default function SettingsPanel({preferences, onPreferenceChange, onLogout}) {
  const [form] = Form.useForm();
  return (
      <div className="panel-content">
        <Form
          form={form}
          layout="vertical"
          initialValues={{simbriefUsername: preferences.simbriefUsername || ''}}
          onFinish={onPreferenceChange}
        >
          <Form.Item label="SimBrief username" name="simbriefUsername">
            <Input placeholder="SimBrief username"/>
          </Form.Item>
          <Space>
            <Button type="primary" htmlType="submit">Save</Button>
            <Button danger onClick={onLogout}>Log out</Button>
          </Space>
        </Form>
        <Text type="secondary" className="settings-note">
          Preferences are stored per OAuth app and user.
        </Text>
      </div>
  );
}
