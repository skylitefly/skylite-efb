import {Button, Form, Input, Select, Space, Switch, Typography} from 'antd';

const {Text} = Typography;

export default function SettingsPanel({preferences, onPreferenceChange, onLogout}) {
  const [form] = Form.useForm();
  return (
      <div className="panel-content">
        <Form
          form={form}
          layout="vertical"
          initialValues={{
            simbriefUsername: preferences.simbriefUsername || '',
            weatherRefreshIntervalSeconds: preferences.weatherRefreshIntervalSeconds ?? 300,
            showAirportDetailOnMap: preferences.showAirportDetailOnMap ?? true,
          }}
          onFinish={onPreferenceChange}
        >
          <Form.Item label="SimBrief username" name="simbriefUsername">
            <Input placeholder="SimBrief username"/>
          </Form.Item>
          <Form.Item label="Weather refresh interval" name="weatherRefreshIntervalSeconds">
            <Select
              options={[
                {value: 300, label: 'Every 5 minutes'},
                {value: 60, label: 'Every 1 minute'},
                {value: 600, label: 'Every 10 minutes'},
                {value: 900, label: 'Every 15 minutes'},
                {value: 0, label: 'Off'},
              ]}
            />
          </Form.Item>
          <Form.Item
            label="Show airport detail on map"
            name="showAirportDetailOnMap"
            valuePropName="checked"
          >
            <Switch/>
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
