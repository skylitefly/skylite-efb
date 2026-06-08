import {Button, Space, Typography} from 'antd';
import {CloseOutlined} from '@ant-design/icons';

const {Title} = Typography;

export default function SidePanel({title, actions, children, onClose}) {
  return (
    <aside className="side-panel">
      <div className="side-panel__header">
        <Title level={5} style={{margin: 0}}>{title}</Title>
        <Space size={6}>
          {actions}
          <Button type="text" icon={<CloseOutlined/>} onClick={onClose}/>
        </Space>
      </div>
      <div className="side-panel__body">{children}</div>
    </aside>
  );
}
