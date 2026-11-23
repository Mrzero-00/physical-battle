// 앱 진입점
import './styles.css';
import { createApp } from './app/router';
import { getPlatform } from './platform';

const root = document.getElementById('app');
if (root) createApp(root, getPlatform());
