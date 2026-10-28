import { checkDirectories, checkSource } from '../../scripts/architecture.cjs';

describe('架构边界', () => {
  it('实际 core 和页面只能依赖允许的模块', () => {
    expect(checkDirectories(['src/core', 'src/ui/screens'])).toEqual([]);
  });

  it.each([
    "import '@data/db';",
    "import {NativeModules} from 'react-native';",
    "import {Linking} from 'react-native';",
    "import * as RN from 'react-native';",
    "import RN from 'react-native';",
    "const RN = require('react-native');",
    "import {db} from '../../data/db';",
    "import type {Book} from '@core/types';",
    "import {useStudyVM} from '@features/study/useStudyVM';",
    "import {StudyViewState} from '@features/study/types';",
    "export {state} from '@features/study/types';",
    "export * from '@services/ai';",
    "const db = require('@data/db');",
    "const db = import('@data/db');",
    'const module = import(moduleName);',
    "import db = require('@data/db');",
    "type Db = import('@data/db').Db;",
    "import {paper} from '@ui/skins/paper';",
    "import {x} from '../../../outside';",
  ])('拒绝页面越界依赖：%s', source => {
    expect(checkSource('src/ui/screens/StudyView.tsx', source)).toHaveLength(1);
  });

  it.each([
    "import React from 'react';",
    "import {View} from 'react-native';",
    "import {Button} from '@ui/kit';",
    "import {Button} from '../kit/Button';",
    "import {Item} from './Item';",
    "import type {StudyViewState} from '@features/study/types';",
    "import {type StudyViewState} from '@features/study/types';",
    "export type {StudyViewState} from '@features/study/types';",
    "type State = import('@features/study/types').StudyViewState;",
  ])('允许页面展示依赖：%s', source => {
    expect(checkSource('src/ui/screens/StudyView.tsx', source)).toEqual([]);
  });

  it.each([
    "import React from 'react';",
    "import {Platform} from 'react-native';",
    "import {create} from 'zustand';",
    "import fs from 'node:fs';",
    "import {db} from '@data/db';",
    "export * from '../services/ai';",
    "const db = require('@data/db');",
    "import('@platform/pdf');",
  ])('拒绝 core 的外部依赖：%s', source => {
    expect(checkSource('src/core/types.ts', source)).toHaveLength(1);
  });

  it('允许 core 内部 alias 与相对导入，忽略注释里的 import', () => {
    expect(
      checkSource(
        'src/core/lesson/index.ts',
        `
      import type {Block} from '@core/types';
      export {blockRef} from '../ids';
      // import '@data/db';
      const text = "import '@services/ai'";
    `,
      ),
    ).toEqual([]);
  });
});
