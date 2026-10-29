package com.pagewise.files

import com.facebook.react.BaseReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.model.ReactModuleInfo
import com.facebook.react.module.model.ReactModuleInfoProvider

class BookFilesPackage : BaseReactPackage() {
  override fun getModule(name:String,context:ReactApplicationContext):NativeModule?=when(name){PdfPagesModule.NAME->PdfPagesModule(context);FileToolsModule.NAME->FileToolsModule(context);IntakeModule.NAME->IntakeModule(context);else->null}
  override fun getReactModuleInfoProvider()=ReactModuleInfoProvider{
    mapOf(
      PdfPagesModule.NAME to ReactModuleInfo(PdfPagesModule.NAME,PdfPagesModule::class.java.name,false,false,false,true),
      FileToolsModule.NAME to ReactModuleInfo(FileToolsModule.NAME,FileToolsModule::class.java.name,false,false,false,true),
      IntakeModule.NAME to ReactModuleInfo(IntakeModule.NAME,IntakeModule::class.java.name,false,false,false,true),
    )
  }
}
