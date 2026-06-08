import {StrictMode} from 'react'
import {createRoot} from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import {ConfigProvider} from "antd";
import 'dayjs/locale/zh-cn';
import zhCN from 'antd/locale/zh_CN';

createRoot(document.getElementById('root')).render(
    <StrictMode>
        <ConfigProvider
            locale={zhCN}
        >
            <App/>
        </ConfigProvider>
    </StrictMode>,
)
