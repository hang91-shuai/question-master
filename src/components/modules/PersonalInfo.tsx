import { Card, Form, Input, Button, message, Avatar, Tag } from 'antd';
import { UserOutlined, SaveOutlined, LockOutlined } from '@ant-design/icons';
import { useAppStore } from '../../store/useAppStore';

export function PersonalInfo() {
  const { profile, updateProfile } = useAppStore();
  const [form] = Form.useForm();

  const handleSave = (values: any) => {
    updateProfile(values);
    message.success('个人信息已保存');
  };

  return (
    <div className="space-y-5">
      <Card>
        <div className="flex items-center gap-3 mb-6 flex-wrap">
          <Avatar size={64} icon={<UserOutlined />} style={{ backgroundColor: '#1677ff' }} />
          <div className="min-w-0">
            <h2 className="text-lg font-bold m-0">{profile.name}</h2>
            <div className="text-gray-500 text-sm">{profile.org} · {profile.role}</div>
          </div>
          <Tag color="blue" className="ml-auto">命题管理员</Tag>
        </div>

        <Form
          form={form}
          layout="vertical"
          initialValues={profile}
          onFinish={handleSave}
          style={{ maxWidth: 560 }}
        >
          <Form.Item name="name" label="姓名" rules={[{ required: true, message: '请输入姓名' }]}>
            <Input prefix={<UserOutlined />} placeholder="请输入姓名" />
          </Form.Item>
          <Form.Item name="org" label="所属机构">
            <Input placeholder="请输入所属机构" />
          </Form.Item>
          <Form.Item name="role" label="职务">
            <Input placeholder="请输入职务" />
          </Form.Item>
          <Form.Item name="email" label="邮箱" rules={[{ type: 'email', message: '邮箱格式不正确' }]}>
            <Input placeholder="请输入邮箱" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" icon={<SaveOutlined />}>保存个人信息</Button>
          </Form.Item>
        </Form>
      </Card>

      <Card title="修改密码">
        <Form layout="vertical" style={{ maxWidth: 560 }}>
          <Form.Item name="old" label="原密码" rules={[{ required: true, message: '请输入原密码' }]}>
            <Input.Password prefix={<LockOutlined />} placeholder="请输入原密码" />
          </Form.Item>
          <Form.Item name="new" label="新密码" rules={[{ required: true, message: '请输入新密码' }]}>
            <Input.Password prefix={<LockOutlined />} placeholder="请输入新密码" />
          </Form.Item>
          <Form.Item name="confirm" label="确认新密码" rules={[{ required: true, message: '请确认新密码' }]}>
            <Input.Password prefix={<LockOutlined />} placeholder="请再次输入新密码" />
          </Form.Item>
          <Form.Item>
            <Button htmlType="button" icon={<SaveOutlined />} onClick={() => message.success('密码修改成功（演示）')}>
              修改密码
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
}
